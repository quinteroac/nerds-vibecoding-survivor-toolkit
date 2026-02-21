import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentInvokeOptions,
  type AgentProvider,
  type AgentResult,
} from "../agent";
import { exists, FLOW_REL_DIR, readState, writeState } from "../state";
import { TestPlanSchema, type TestPlan } from "../../schemas/test-plan";

export interface ExecuteTestPlanOptions {
  provider: AgentProvider;
}

const ExecutionPayloadSchema = z.object({
  status: z.enum(["passed", "failed", "skipped"]),
  evidence: z.string(),
  notes: z.string(),
});

type ExecutionPayload = z.infer<typeof ExecutionPayloadSchema>;

const TestExecutionProgressStatusSchema = z.enum(["pending", "in_progress", "passed", "failed"]);

const TestExecutionProgressEntrySchema = z.object({
  id: z.string(),
  type: z.enum(["automated", "exploratory_manual"]),
  status: TestExecutionProgressStatusSchema,
  attempt_count: z.number().int().nonnegative(),
  last_agent_exit_code: z.number().int().nullable(),
  last_error_summary: z.string(),
  updated_at: z.string(),
});

const TestExecutionProgressSchema = z.object({
  entries: z.array(TestExecutionProgressEntrySchema),
});

type TestExecutionProgress = z.infer<typeof TestExecutionProgressSchema>;

interface FlatTestCase {
  id: string;
  description: string;
  mode: "automated" | "exploratory_manual";
  correlatedRequirements: string[];
}

interface TestExecutionResult {
  testCaseId: string;
  description: string;
  correlatedRequirements: string[];
  mode: "automated" | "exploratory_manual";
  payload: {
    status: "passed" | "failed" | "skipped" | "invocation_failed";
    evidence: string;
    notes: string;
  };
  passFail: "pass" | "fail" | null;
  agentExitCode: number;
  artifactReferences: string[];
}

interface TestExecutionReport {
  iteration: string;
  testPlanFile: string;
  executedTestIds: string[];
  results: TestExecutionResult[];
}

interface ExecuteTestPlanDeps {
  existsFn: (path: string) => Promise<boolean>;
  invokeAgentFn: (options: AgentInvokeOptions) => Promise<AgentResult>;
  loadSkillFn: (projectRoot: string, skillName: string) => Promise<string>;
  mkdirFn: typeof mkdir;
  nowFn: () => Date;
  readFileFn: typeof readFile;
  writeFileFn: typeof Bun.write;
}

const defaultDeps: ExecuteTestPlanDeps = {
  existsFn: exists,
  invokeAgentFn: invokeAgent,
  loadSkillFn: loadSkill,
  mkdirFn: mkdir,
  nowFn: () => new Date(),
  readFileFn: readFile,
  writeFileFn: Bun.write,
};

function flattenTests(testPlan: TestPlan): FlatTestCase[] {
  const automated = testPlan.automatedTests.map((item) => ({
    id: item.id,
    description: item.description,
    mode: "automated" as const,
    correlatedRequirements: item.correlatedRequirements,
  }));
  const manual = testPlan.exploratoryManualTests.map((item) => ({
    id: item.id,
    description: item.description,
    mode: "exploratory_manual" as const,
    correlatedRequirements: item.correlatedRequirements,
  }));
  return [...automated, ...manual];
}

function buildExecutionPrompt(
  skillBody: string,
  testCase: FlatTestCase,
  projectContextContent: string,
): string {
  return buildPrompt(skillBody, {
    project_context: projectContextContent,
    test_case_definition: JSON.stringify(testCase, null, 2),
  });
}

function parseExecutionPayload(raw: string): ExecutionPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("Agent output was not valid JSON.", { cause: error });
  }

  const validation = ExecutionPayloadSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error("Agent output did not match required execution payload schema.", {
      cause: validation.error,
    });
  }

  return validation.data;
}

function derivePassFail(status: ExecutionPayload["status"]): "pass" | "fail" | null {
  if (status === "passed") return "pass";
  if (status === "failed") return "fail";
  return null;
}

function sortedValues(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function idsMatchExactly(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }

  return true;
}

function toArtifactSafeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function buildArtifactFileName(testCaseId: string, attemptNumber: number): string {
  const safeId = toArtifactSafeSegment(testCaseId);
  const paddedAttempt = attemptNumber.toString().padStart(3, "0");
  return `${safeId}_attempt_${paddedAttempt}.json`;
}

function buildMarkdownReport(report: TestExecutionReport): string {
  const totalTests = report.results.length;
  const passedCount = report.results.filter((result) => result.payload.status === "passed").length;
  const failedCount = totalTests - passedCount;

  const lines = [
    `# Test Execution Report (Iteration ${report.iteration})`,
    "",
    `- Test Plan: \`${report.testPlanFile}\``,
    `- Total Tests: ${totalTests}`,
    `- Passed: ${passedCount}`,
    `- Failed: ${failedCount}`,
    "",
    "| Test ID | Description | Status | Correlated Requirements | Artifacts |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const result of report.results) {
    const correlatedRequirements = result.correlatedRequirements.join(", ");
    const artifactReferences = result.artifactReferences.map((path) => `\`${path}\``).join("<br>");
    lines.push(
      `| ${result.testCaseId} | ${result.description} | ${result.payload.status} | ${correlatedRequirements} | ${artifactReferences} |`,
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export async function runExecuteTestPlan(
  opts: ExecuteTestPlanOptions,
  deps: Partial<ExecuteTestPlanDeps> = {},
): Promise<void> {
  const projectRoot = process.cwd();
  const mergedDeps: ExecuteTestPlanDeps = { ...defaultDeps, ...deps };
  const state = await readState(projectRoot);

  const tpGeneration = state.phases.prototype.tp_generation;
  if (tpGeneration.status !== "created") {
    throw new Error(
      `Cannot execute test plan: prototype.tp_generation.status must be created. Current status: '${tpGeneration.status}'. Run \`bun nvst approve test-plan\` first.`,
    );
  }

  if (!tpGeneration.file) {
    throw new Error("Cannot execute test plan: prototype.tp_generation.file is missing.");
  }

  const testPlanPath = join(projectRoot, FLOW_REL_DIR, tpGeneration.file);
  if (!(await mergedDeps.existsFn(testPlanPath))) {
    throw new Error(`Cannot execute test plan: file not found at ${testPlanPath}`);
  }

  let parsedTestPlan: unknown;
  try {
    parsedTestPlan = JSON.parse(await mergedDeps.readFileFn(testPlanPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid test plan JSON at ${join(FLOW_REL_DIR, tpGeneration.file)}.`, {
      cause: error,
    });
  }

  const testPlanValidation = TestPlanSchema.safeParse(parsedTestPlan);
  if (!testPlanValidation.success) {
    throw new Error(
      `Test plan JSON schema mismatch at ${join(FLOW_REL_DIR, tpGeneration.file)}.`,
      { cause: testPlanValidation.error },
    );
  }

  const projectContextPath = join(projectRoot, ".agents", "PROJECT_CONTEXT.md");
  if (!(await mergedDeps.existsFn(projectContextPath))) {
    throw new Error("Project context missing: expected .agents/PROJECT_CONTEXT.md.");
  }
  const projectContextContent = await mergedDeps.readFileFn(projectContextPath, "utf8");
  let skillBody: string;
  try {
    skillBody = await mergedDeps.loadSkillFn(projectRoot, "execute-test-case");
  } catch {
    throw new Error(
      "Required skill missing: expected .agents/skills/execute-test-case/SKILL.md.",
    );
  }

  const testCases = flattenTests(testPlanValidation.data);
  const now = new Date().toISOString();
  const progressFileName = `it_${state.current_iteration}_test-execution-progress.json`;
  const progressPath = join(projectRoot, FLOW_REL_DIR, progressFileName);
  const artifactsDirName = `it_${state.current_iteration}_test-execution-artifacts`;
  const artifactsDirPath = join(projectRoot, FLOW_REL_DIR, artifactsDirName);

  state.phases.prototype.test_execution.status = "in_progress";
  state.phases.prototype.test_execution.file = progressFileName;
  state.last_updated = mergedDeps.nowFn().toISOString();
  state.updated_by = "nvst:execute-test-plan";
  await writeState(projectRoot, state);

  let progress: TestExecutionProgress;
  if (await mergedDeps.existsFn(progressPath)) {
    let parsedProgress: unknown;
    try {
      parsedProgress = JSON.parse(await mergedDeps.readFileFn(progressPath, "utf8"));
    } catch (error) {
      throw new Error(`Invalid progress JSON at ${join(FLOW_REL_DIR, progressFileName)}.`, {
        cause: error,
      });
    }

    const progressValidation = TestExecutionProgressSchema.safeParse(parsedProgress);
    if (!progressValidation.success) {
      throw new Error(
        `Progress JSON schema mismatch at ${join(FLOW_REL_DIR, progressFileName)}.`,
        { cause: progressValidation.error },
      );
    }

    const expectedIds = sortedValues(testCases.map((testCase) => testCase.id));
    const existingIds = sortedValues(progressValidation.data.entries.map((entry) => entry.id));
    if (!idsMatchExactly(existingIds, expectedIds)) {
      throw new Error(
        "Test execution progress file out of sync: entry ids do not match approved test plan test ids.",
      );
    }

    progress = progressValidation.data;
  } else {
    progress = {
      entries: testCases.map((testCase) => ({
        id: testCase.id,
        type: testCase.mode,
        status: "pending",
        attempt_count: 0,
        last_agent_exit_code: null,
        last_error_summary: "",
        updated_at: now,
      })),
    };
  }

  const executionByTestId = new Map<string, TestExecutionResult>();
  const executedTestIds: string[] = [];

  const writeProgress = async () => {
    await mergedDeps.writeFileFn(progressPath, `${JSON.stringify(progress, null, 2)}\n`);
  };

  await mergedDeps.mkdirFn(join(projectRoot, FLOW_REL_DIR), { recursive: true });
  await mergedDeps.mkdirFn(artifactsDirPath, { recursive: true });
  await writeProgress();

  for (const testCase of testCases) {
    const progressEntry = progress.entries.find((entry) => entry.id === testCase.id);
    if (!progressEntry) {
      throw new Error(`Missing progress entry for test case '${testCase.id}'.`);
    }

    if (progressEntry.status === "passed") {
      continue;
    }

    progressEntry.status = "in_progress";
    progressEntry.updated_at = new Date().toISOString();
    await writeProgress();

    const prompt = buildExecutionPrompt(skillBody, testCase, projectContextContent);
    const agentResult = await mergedDeps.invokeAgentFn({
      provider: opts.provider,
      prompt,
      cwd: projectRoot,
      interactive: false,
    });

    executedTestIds.push(testCase.id);
    const attemptNumber = progressEntry.attempt_count + 1;
    const artifactFileName = buildArtifactFileName(testCase.id, attemptNumber);
    const artifactRelativePath = join(FLOW_REL_DIR, artifactsDirName, artifactFileName);
    const artifactAbsolutePath = join(projectRoot, artifactRelativePath);

    if (agentResult.exitCode !== 0) {
      progressEntry.attempt_count += 1;
      progressEntry.last_agent_exit_code = agentResult.exitCode;
      progressEntry.last_error_summary = `Agent invocation failed with exit code ${agentResult.exitCode}.`;
      progressEntry.status = "failed";
      progressEntry.updated_at = new Date().toISOString();
      await writeProgress();

      await mergedDeps.writeFileFn(
        artifactAbsolutePath,
        `${JSON.stringify(
          {
            testCaseId: testCase.id,
            attemptNumber,
            prompt,
            agentExitCode: agentResult.exitCode,
            stdout: agentResult.stdout,
            stderr: agentResult.stderr,
            payload: {
              status: "invocation_failed",
              evidence: "",
              notes: progressEntry.last_error_summary,
            },
          },
          null,
          2,
        )}\n`,
      );

      executionByTestId.set(testCase.id, {
        testCaseId: testCase.id,
        description: testCase.description,
        correlatedRequirements: testCase.correlatedRequirements,
        mode: testCase.mode,
        payload: {
          status: "invocation_failed",
          evidence: "",
          notes: progressEntry.last_error_summary,
        },
        passFail: null,
        agentExitCode: agentResult.exitCode,
        artifactReferences: [artifactRelativePath],
      });
      continue;
    }

    let payload: ExecutionPayload;
    try {
      payload = parseExecutionPayload(agentResult.stdout.trim());
    } catch (error) {
      const summary = error instanceof Error ? error.message : "Unknown execution parsing error.";
      progressEntry.attempt_count += 1;
      progressEntry.last_agent_exit_code = agentResult.exitCode;
      progressEntry.last_error_summary = summary;
      progressEntry.status = "failed";
      progressEntry.updated_at = new Date().toISOString();
      await writeProgress();

      await mergedDeps.writeFileFn(
        artifactAbsolutePath,
        `${JSON.stringify(
          {
            testCaseId: testCase.id,
            attemptNumber,
            prompt,
            agentExitCode: agentResult.exitCode,
            stdout: agentResult.stdout,
            stderr: agentResult.stderr,
            payload: {
              status: "invocation_failed",
              evidence: "",
              notes: summary,
            },
          },
          null,
          2,
        )}\n`,
      );

      executionByTestId.set(testCase.id, {
        testCaseId: testCase.id,
        description: testCase.description,
        correlatedRequirements: testCase.correlatedRequirements,
        mode: testCase.mode,
        payload: {
          status: "invocation_failed",
          evidence: "",
          notes: summary,
        },
        passFail: null,
        agentExitCode: agentResult.exitCode,
        artifactReferences: [artifactRelativePath],
      });
      continue;
    }

    progressEntry.attempt_count += 1;
    progressEntry.last_agent_exit_code = agentResult.exitCode;
    progressEntry.last_error_summary = payload.status === "passed" ? "" : payload.notes;
    progressEntry.status = payload.status === "passed" ? "passed" : "failed";
    progressEntry.updated_at = new Date().toISOString();
    await writeProgress();

    await mergedDeps.writeFileFn(
      artifactAbsolutePath,
      `${JSON.stringify(
        {
          testCaseId: testCase.id,
          attemptNumber,
          prompt,
          agentExitCode: agentResult.exitCode,
          stdout: agentResult.stdout,
          stderr: agentResult.stderr,
          payload,
        },
        null,
        2,
      )}\n`,
    );

    executionByTestId.set(testCase.id, {
      testCaseId: testCase.id,
      description: testCase.description,
      correlatedRequirements: testCase.correlatedRequirements,
      mode: testCase.mode,
      payload,
      passFail: derivePassFail(payload.status),
      agentExitCode: agentResult.exitCode,
      artifactReferences: [artifactRelativePath],
    });
  }

  const results: TestExecutionResult[] = testCases.map((testCase) => {
    const progressEntry = progress.entries.find((entry) => entry.id === testCase.id);
    if (!progressEntry) {
      throw new Error(`Missing progress entry for test case '${testCase.id}' after execution.`);
    }

    const latestExecution = executionByTestId.get(testCase.id);
    if (latestExecution) {
      return latestExecution;
    }

    const attemptArtifacts = Array.from({ length: progressEntry.attempt_count }, (_, index) => {
      const attemptNumber = index + 1;
      const artifactFileName = buildArtifactFileName(testCase.id, attemptNumber);
      return join(FLOW_REL_DIR, artifactsDirName, artifactFileName);
    });

    return {
      testCaseId: testCase.id,
      description: testCase.description,
      correlatedRequirements: testCase.correlatedRequirements,
      mode: testCase.mode,
      payload: {
        status: progressEntry.status === "passed" ? "passed" : "failed",
        evidence: "",
        notes: progressEntry.last_error_summary,
      },
      passFail: progressEntry.status === "passed" ? "pass" : "fail",
      agentExitCode: progressEntry.last_agent_exit_code ?? 0,
      artifactReferences: attemptArtifacts,
    };
  });

  const report: TestExecutionReport = {
    iteration: state.current_iteration,
    testPlanFile: tpGeneration.file,
    executedTestIds,
    results,
  };

  const outFileName = `it_${state.current_iteration}_test-execution-results.json`;
  const outPath = join(projectRoot, FLOW_REL_DIR, outFileName);
  await mergedDeps.writeFileFn(outPath, `${JSON.stringify(report, null, 2)}\n`);
  const markdownReportFileName = `it_${state.current_iteration}_test-execution-report.md`;
  const markdownReportPath = join(projectRoot, FLOW_REL_DIR, markdownReportFileName);
  await mergedDeps.writeFileFn(markdownReportPath, buildMarkdownReport(report));

  const hasFailedTests = progress.entries.some((entry) => entry.status === "failed");
  state.phases.prototype.test_execution.status = hasFailedTests ? "failed" : "completed";
  state.phases.prototype.test_execution.file = progressFileName;
  state.last_updated = mergedDeps.nowFn().toISOString();
  state.updated_by = "nvst:execute-test-plan";
  await writeState(projectRoot, state);

  const passedCount = results.filter((result) => result.payload.status === "passed").length;
  const failedCount = results.length - passedCount;
  console.log(
    `${passedCount}/${results.length} tests passed, ${failedCount} failed. Report: ${join(FLOW_REL_DIR, markdownReportFileName)}`,
  );
}
