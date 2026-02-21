import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseProvider, type AgentResult } from "../agent";
import { readState, writeState } from "../state";
import { runExecuteTestPlan } from "./execute-test-plan";

async function createProjectRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-execute-test-plan-"));
}

async function withCwd<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

async function seedState(
  projectRoot: string,
  tpStatus: "pending" | "created",
  tpFile: string | null,
) {
  await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });

  await writeState(projectRoot, {
    current_iteration: "000005",
    current_phase: "prototype",
    phases: {
      define: {
        requirement_definition: { status: "approved", file: "it_000005_product-requirement-document.md" },
        prd_generation: { status: "completed", file: "it_000005_PRD.json" },
      },
      prototype: {
        project_context: { status: "created", file: ".agents/PROJECT_CONTEXT.md" },
        test_plan: { status: "created", file: "it_000005_test-plan.md" },
        tp_generation: { status: tpStatus, file: tpFile },
        prototype_build: { status: "pending", file: null },
        test_execution: { status: "pending", file: null },
        prototype_approved: false,
      },
      refactor: {
        evaluation_report: { status: "pending", file: null },
        refactor_plan: { status: "pending", file: null },
        refactor_execution: { status: "pending", file: null },
        changelog: { status: "pending", file: null },
      },
    },
    last_updated: "2026-02-21T00:00:00.000Z",
    updated_by: "seed",
    history: [],
  });
}

async function writeProjectContext(projectRoot: string, content = "# Project Context\n- use bun:test\n") {
  await writeFile(join(projectRoot, ".agents", "PROJECT_CONTEXT.md"), content, "utf8");
}

async function writeApprovedTpJson(projectRoot: string, fileName: string) {
  const tpPath = join(projectRoot, ".agents", "flow", fileName);
  await writeFile(
    tpPath,
    JSON.stringify(
      {
        overallStatus: "pending",
        scope: ["Scope A"],
        environmentData: ["Env A"],
        automatedTests: [
          {
            id: "TC-US001-01",
            description: "Automated case one",
            status: "pending",
            correlatedRequirements: ["US-001", "FR-1"],
          },
          {
            id: "TC-US001-02",
            description: "Automated case two",
            status: "pending",
            correlatedRequirements: ["US-001", "FR-2"],
          },
        ],
        exploratoryManualTests: [
          {
            id: "TC-US001-03",
            description: "Manual case",
            status: "pending",
            correlatedRequirements: ["US-001", "FR-3"],
          },
        ],
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("execute test-plan command", () => {
  test("registers execute test-plan command in CLI dispatch with --agent provider", async () => {
    const source = await readFile(join(process.cwd(), "src", "cli.ts"), "utf8");

    expect(source).toContain('import { runExecuteTestPlan } from "./commands/execute-test-plan";');
    expect(source).toContain("if (command === \"execute\") {");
    expect(source).toContain('if (subcommand === "test-plan") {');
    expect(source).toContain("const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));");
    expect(source).toContain("await runExecuteTestPlan({ provider });");
    expect(source).toContain("execute test-plan --agent <provider>");
  });

  test("fails when tp_generation.status is not created", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);

    await seedState(projectRoot, "pending", "it_000005_TP.json");
    await writeProjectContext(projectRoot);

    await withCwd(projectRoot, async () => {
      await expect(runExecuteTestPlan({ provider: "codex" })).rejects.toThrow(
        "Cannot execute test plan: prototype.tp_generation.status must be created. Current status: 'pending'. Run `bun nvst approve test-plan` first.",
      );
    });
  });

  test("reads approved TP JSON from state path and executes all test cases one by one in source order", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);

    const tpFileName = "it_000005_TP.json";
    await seedState(projectRoot, "created", tpFileName);
    await writeProjectContext(projectRoot, "# Project Context\nUse bun test and tsc checks.\n");
    await writeApprovedTpJson(projectRoot, tpFileName);

    const invocationTestIds: string[] = [];

    await withCwd(projectRoot, async () => {
      let sawInProgressState = false;
      await runExecuteTestPlan(
        { provider: "gemini" },
        {
          invokeAgentFn: async (options): Promise<AgentResult> => {
            if (!sawInProgressState) {
              const liveState = await readState(projectRoot);
              expect(liveState.phases.prototype.test_execution.status).toBe("in_progress");
              expect(liveState.phases.prototype.test_execution.file).toBe(
                "it_000005_test-execution-progress.json",
              );
              sawInProgressState = true;
            }
            expect(options.interactive).toBe(false);
            expect(options.prompt).toContain("### project_context_reference");
            expect(options.prompt).toContain("Use bun test and tsc checks.");

            if (options.prompt.includes("TC-US001-01")) invocationTestIds.push("TC-US001-01");
            if (options.prompt.includes("TC-US001-02")) invocationTestIds.push("TC-US001-02");
            if (options.prompt.includes("TC-US001-03")) invocationTestIds.push("TC-US001-03");

            return {
              exitCode: 0,
              stdout: JSON.stringify({
                status: "passed",
                evidence: "Command output captured",
                notes: "Executed successfully",
              }),
              stderr: "",
            };
          },
        },
      );
    });

    expect(invocationTestIds).toEqual(["TC-US001-01", "TC-US001-02", "TC-US001-03"]);

    const reportRaw = await readFile(
      join(projectRoot, ".agents", "flow", "it_000005_test-execution-results.json"),
      "utf8",
    );
    const report = JSON.parse(reportRaw) as {
      executedTestIds: string[];
      results: Array<{ testCaseId: string; payload: { status: string; evidence: string; notes: string } }>;
    };

    expect(report.executedTestIds).toEqual(["TC-US001-01", "TC-US001-02", "TC-US001-03"]);
    expect(report.results).toHaveLength(3);
    expect(report.results[0]?.payload).toEqual({
      status: "passed",
      evidence: "Command output captured",
      notes: "Executed successfully",
    });

    const progressRaw = await readFile(
      join(projectRoot, ".agents", "flow", "it_000005_test-execution-progress.json"),
      "utf8",
    );
    const progress = JSON.parse(progressRaw) as {
      entries: Array<{
        id: string;
        type: "automated" | "exploratory_manual";
        status: "pending" | "in_progress" | "passed" | "failed";
        attempt_count: number;
        last_agent_exit_code: number | null;
        last_error_summary: string;
        updated_at: string;
      }>;
    };

    expect(progress.entries).toHaveLength(3);
    expect(progress.entries[0]).toMatchObject({
      id: "TC-US001-01",
      type: "automated",
      status: "passed",
      attempt_count: 1,
      last_agent_exit_code: 0,
      last_error_summary: "",
    });
    expect(progress.entries[2]).toMatchObject({
      id: "TC-US001-03",
      type: "exploratory_manual",
      status: "passed",
      attempt_count: 1,
      last_agent_exit_code: 0,
      last_error_summary: "",
    });
    expect(typeof progress.entries[0]?.updated_at).toBe("string");

    const state = await readState(projectRoot);
    expect(state.phases.prototype.test_execution.status).toBe("completed");
    expect(state.phases.prototype.test_execution.file).toBe("it_000005_test-execution-progress.json");
    expect(state.updated_by).toBe("nvst:execute-test-plan");
  });

  test("derives pass/fail from payload status and treats non-zero agent exit as invocation failure", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);

    await seedState(projectRoot, "created", "it_000005_TP.json");
    await writeProjectContext(projectRoot);
    await writeApprovedTpJson(projectRoot, "it_000005_TP.json");

    let call = 0;

    await withCwd(projectRoot, async () => {
      await runExecuteTestPlan(
        { provider: "claude" },
        {
          invokeAgentFn: async () => {
            call += 1;
            if (call === 1) {
              return {
                exitCode: 0,
                stdout: JSON.stringify({
                  status: "failed",
                  evidence: "Assertion mismatch",
                  notes: "Expected error message not found",
                }),
                stderr: "",
              };
            }

            if (call === 2) {
              return {
                exitCode: 1,
                stdout: "",
                stderr: "agent crashed",
              };
            }

            return {
              exitCode: 0,
              stdout: JSON.stringify({
                status: "skipped",
                evidence: "",
                notes: "Manual step blocked by missing credentials",
              }),
              stderr: "",
            };
          },
        },
      );
    });

    const reportRaw = await readFile(
      join(projectRoot, ".agents", "flow", "it_000005_test-execution-results.json"),
      "utf8",
    );
    const report = JSON.parse(reportRaw) as {
      results: Array<{
        testCaseId: string;
        payload: { status: string; evidence: string; notes: string };
        passFail: "pass" | "fail" | null;
        agentExitCode: number;
      }>;
    };

    expect(report.results[0]?.payload.status).toBe("failed");
    expect(report.results[0]?.passFail).toBe("fail");

    expect(report.results[1]?.payload.status).toBe("invocation_failed");
    expect(report.results[1]?.payload.evidence).toBe("");
    expect(report.results[1]?.payload.notes).toContain("Agent invocation failed with exit code 1");
    expect(report.results[1]?.passFail).toBeNull();
    expect(report.results[1]?.agentExitCode).toBe(1);

    expect(report.results[2]?.payload.status).toBe("skipped");
    expect(report.results[2]?.passFail).toBeNull();

    const state = await readState(projectRoot);
    expect(state.phases.prototype.test_execution.status).toBe("failed");
    expect(state.phases.prototype.test_execution.file).toBe("it_000005_test-execution-progress.json");
  });

  test("supports claude, codex, and gemini providers", () => {
    expect(parseProvider("claude")).toBe("claude");
    expect(parseProvider("codex")).toBe("codex");
    expect(parseProvider("gemini")).toBe("gemini");
  });

  test("updates execution progress file after each test case execution attempt", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);

    const tpFileName = "it_000005_TP.json";
    await seedState(projectRoot, "created", tpFileName);
    await writeProjectContext(projectRoot);
    await writeApprovedTpJson(projectRoot, tpFileName);

    const progressSnapshots: string[] = [];

    await withCwd(projectRoot, async () => {
      await runExecuteTestPlan(
        { provider: "codex" },
        {
          invokeAgentFn: async (): Promise<AgentResult> => ({
            exitCode: 0,
            stdout: JSON.stringify({
              status: "passed",
              evidence: "ok",
              notes: "ok",
            }),
            stderr: "",
          }),
          writeFileFn: async (path, data) => {
            const pathAsString = path.toString();
            if (pathAsString.endsWith("it_000005_test-execution-progress.json")) {
              progressSnapshots.push(data.toString());
            }
            await writeFile(pathAsString, data.toString(), "utf8");
            return 0;
          },
        },
      );
    });

    expect(progressSnapshots.length).toBeGreaterThanOrEqual(7);
    expect(progressSnapshots.at(-1)).toContain('"attempt_count": 1');
    expect(progressSnapshots.at(-1)).toContain('"status": "passed"');
  });

  test("resumes only pending or failed tests on re-run and skips previously passed tests", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);

    const tpFileName = "it_000005_TP.json";
    await seedState(projectRoot, "created", tpFileName);
    await writeProjectContext(projectRoot);
    await writeApprovedTpJson(projectRoot, tpFileName);

    await withCwd(projectRoot, async () => {
      let firstRunCall = 0;
      await runExecuteTestPlan(
        { provider: "claude" },
        {
          invokeAgentFn: async (): Promise<AgentResult> => {
            firstRunCall += 1;
            if (firstRunCall === 2) {
              return {
                exitCode: 0,
                stdout: JSON.stringify({
                  status: "failed",
                  evidence: "assertion mismatch",
                  notes: "failed on second case",
                }),
                stderr: "",
              };
            }

            return {
              exitCode: 0,
              stdout: JSON.stringify({
                status: "passed",
                evidence: "ok",
                notes: "ok",
              }),
              stderr: "",
            };
          },
        },
      );

      const rerunInvokedIds: string[] = [];
      await runExecuteTestPlan(
        { provider: "claude" },
        {
          invokeAgentFn: async (options): Promise<AgentResult> => {
            if (options.prompt.includes("TC-US001-01")) rerunInvokedIds.push("TC-US001-01");
            if (options.prompt.includes("TC-US001-02")) rerunInvokedIds.push("TC-US001-02");
            if (options.prompt.includes("TC-US001-03")) rerunInvokedIds.push("TC-US001-03");
            return {
              exitCode: 0,
              stdout: JSON.stringify({
                status: "passed",
                evidence: "retry ok",
                notes: "retry succeeded",
              }),
              stderr: "",
            };
          },
        },
      );

      expect(rerunInvokedIds).toEqual(["TC-US001-02"]);
    });

    const progressRaw = await readFile(
      join(projectRoot, ".agents", "flow", "it_000005_test-execution-progress.json"),
      "utf8",
    );
    const progress = JSON.parse(progressRaw) as {
      entries: Array<{ id: string; status: string; attempt_count: number }>;
    };

    expect(progress.entries.find((entry) => entry.id === "TC-US001-01")).toMatchObject({
      id: "TC-US001-01",
      status: "passed",
      attempt_count: 1,
    });
    expect(progress.entries.find((entry) => entry.id === "TC-US001-02")).toMatchObject({
      id: "TC-US001-02",
      status: "passed",
      attempt_count: 2,
    });
    expect(progress.entries.find((entry) => entry.id === "TC-US001-03")).toMatchObject({
      id: "TC-US001-03",
      status: "passed",
      attempt_count: 1,
    });
  });
});
