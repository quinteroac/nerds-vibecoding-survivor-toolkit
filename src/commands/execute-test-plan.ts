import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

import {
  buildPrompt,
  invokeAgent,
  type AgentInvokeOptions,
  type AgentProvider,
  type AgentResult,
} from "../agent";
import { exists, FLOW_REL_DIR, readState } from "../state";
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

interface FlatTestCase {
  id: string;
  description: string;
  mode: "automated" | "exploratory_manual";
}

interface TestExecutionResult {
  testCaseId: string;
  mode: "automated" | "exploratory_manual";
  payload: {
    status: "passed" | "failed" | "skipped" | "invocation_failed";
    evidence: string;
    notes: string;
  };
  passFail: "pass" | "fail" | null;
  agentExitCode: number;
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
  mkdirFn: typeof mkdir;
  readFileFn: typeof readFile;
  writeFileFn: typeof Bun.write;
}

const defaultDeps: ExecuteTestPlanDeps = {
  existsFn: exists,
  invokeAgentFn: invokeAgent,
  mkdirFn: mkdir,
  readFileFn: readFile,
  writeFileFn: Bun.write,
};

function flattenTests(testPlan: TestPlan): FlatTestCase[] {
  const automated = testPlan.automatedTests.map((item) => ({
    id: item.id,
    description: item.description,
    mode: "automated" as const,
  }));
  const manual = testPlan.exploratoryManualTests.map((item) => ({
    id: item.id,
    description: item.description,
    mode: "exploratory_manual" as const,
  }));
  return [...automated, ...manual];
}

function buildExecutionPrompt(testCase: FlatTestCase, projectContextContent: string): string {
  return buildPrompt(
    [
      "Execute exactly this test case from an approved test plan.",
      "Return only JSON with this exact shape:",
      '{"status":"passed|failed|skipped","evidence":"...","notes":"..."}',
      "Do not output markdown.",
    ].join("\n"),
    {
      project_context_reference: projectContextContent,
      test_case: JSON.stringify(testCase, null, 2),
    },
  );
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

  const testCases = flattenTests(testPlanValidation.data);

  const results: TestExecutionResult[] = [];
  const executedTestIds: string[] = [];

  for (const testCase of testCases) {
    const prompt = buildExecutionPrompt(testCase, projectContextContent);
    const agentResult = await mergedDeps.invokeAgentFn({
      provider: opts.provider,
      prompt,
      cwd: projectRoot,
      interactive: false,
    });

    executedTestIds.push(testCase.id);

    if (agentResult.exitCode !== 0) {
      results.push({
        testCaseId: testCase.id,
        mode: testCase.mode,
        payload: {
          status: "invocation_failed",
          evidence: "",
          notes: `Agent invocation failed with exit code ${agentResult.exitCode}.`,
        },
        passFail: null,
        agentExitCode: agentResult.exitCode,
      });
      continue;
    }

    const payload = parseExecutionPayload(agentResult.stdout.trim());
    results.push({
      testCaseId: testCase.id,
      mode: testCase.mode,
      payload,
      passFail: derivePassFail(payload.status),
      agentExitCode: agentResult.exitCode,
    });
  }

  const report: TestExecutionReport = {
    iteration: state.current_iteration,
    testPlanFile: tpGeneration.file,
    executedTestIds,
    results,
  };

  await mergedDeps.mkdirFn(join(projectRoot, FLOW_REL_DIR), { recursive: true });
  const outFileName = `it_${state.current_iteration}_test-execution-results.json`;
  const outPath = join(projectRoot, FLOW_REL_DIR, outFileName);
  await mergedDeps.writeFileFn(outPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Executed ${results.length} test case(s). Results saved to ${join(FLOW_REL_DIR, outFileName)}.`);
}
