import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type AgentResult } from "../agent";
import { readState, writeState } from "../state";
import { runExecuteRefactor, RefactorExecutionProgressSchema } from "./execute-refactor";

async function createProjectRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-execute-refactor-"));
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
  opts: {
    phase?: "define" | "prototype" | "refactor";
    refactorPlanStatus?: "pending" | "pending_approval" | "approved";
    refactorExecutionStatus?: "pending" | "in_progress" | "completed";
    iteration?: string;
  } = {},
) {
  const {
    phase = "refactor",
    refactorPlanStatus = "approved",
    refactorExecutionStatus = "pending",
    iteration = "000013",
  } = opts;

  await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });
  await writeState(projectRoot, {
    current_iteration: iteration,
    current_phase: phase,
    phases: {
      define: {
        requirement_definition: { status: "approved", file: `it_${iteration}_product-requirement-document.md` },
        prd_generation: { status: "completed", file: `it_${iteration}_PRD.json` },
      },
      prototype: {
        project_context: { status: "created", file: ".agents/PROJECT_CONTEXT.md" },
        test_plan: { status: "created", file: `it_${iteration}_test-plan.md` },
        tp_generation: { status: "created", file: `it_${iteration}_TP.json` },
        prototype_build: { status: "created", file: `it_${iteration}_progress.json` },
        test_execution: { status: "completed", file: `it_${iteration}_test-execution-report.json` },
        prototype_approved: true,
      },
      refactor: {
        evaluation_report: { status: "created", file: `it_${iteration}_evaluation-report.md` },
        refactor_plan: { status: refactorPlanStatus, file: refactorPlanStatus === "approved" ? `it_${iteration}_refactor-plan.md` : null },
        refactor_execution: { status: refactorExecutionStatus, file: null },
        changelog: { status: "pending", file: null },
      },
    },
    last_updated: "2026-02-26T00:00:00.000Z",
    updated_by: "seed",
    history: [],
  });
}

async function writeRefactorPrd(
  projectRoot: string,
  iteration: string,
  items: Array<{ id: string; title: string; description: string; rationale: string }>,
) {
  const fileName = `it_${iteration}_refactor-prd.json`;
  const filePath = join(projectRoot, ".agents", "flow", fileName);
  await writeFile(
    filePath,
    `${JSON.stringify({ refactorItems: items }, null, 2)}\n`,
    "utf8",
  );
  return fileName;
}

function makeAgentResult(exitCode: number): AgentResult {
  return { exitCode, stdout: "", stderr: "" };
}

function makeSkillFn(content = "# Execute Refactor Item\nApply the refactor item.") {
  return async (_projectRoot: string, _skillName: string) => content;
}

const createdRoots: string[] = [];

afterEach(async () => {
  process.exitCode = 0;
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("execute refactor command", () => {
  test("registers execute refactor command in CLI dispatch", async () => {
    const source = await readFile(join(process.cwd(), "src", "cli.ts"), "utf8");

    expect(source).toContain('import { runExecuteRefactor } from "./commands/execute-refactor";');
    expect(source).toContain('if (subcommand === "refactor") {');
    expect(source).toContain("await runExecuteRefactor({ provider });");
    expect(source).toContain("execute refactor --agent <provider>");
  });

  // AC02: Rejects if current_phase !== "refactor"
  test("rejects with error when current_phase is not refactor", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, { phase: "prototype" });

    await withCwd(projectRoot, async () => {
      await expect(
        runExecuteRefactor(
          { provider: "claude" },
          { loadSkillFn: makeSkillFn() },
        ),
      ).rejects.toThrow("Cannot execute refactor: current_phase must be 'refactor'. Current phase: 'prototype'.");
    });
  });

  // AC03: Rejects if refactor_plan.status !== "approved"
  test("rejects with error when refactor_plan.status is not approved", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, { refactorPlanStatus: "pending" });

    await withCwd(projectRoot, async () => {
      await expect(
        runExecuteRefactor(
          { provider: "claude" },
          { loadSkillFn: makeSkillFn() },
        ),
      ).rejects.toThrow("Cannot execute refactor: refactor_plan.status must be 'approved'. Current status: 'pending'.");
    });
  });

  // AC03: pending_approval variant
  test("rejects with error when refactor_plan.status is pending_approval", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, { refactorPlanStatus: "pending_approval" });

    await withCwd(projectRoot, async () => {
      await expect(
        runExecuteRefactor(
          { provider: "claude" },
          { loadSkillFn: makeSkillFn() },
        ),
      ).rejects.toThrow("Cannot execute refactor: refactor_plan.status must be 'approved'. Current status: 'pending_approval'.");
    });
  });

  // AC04: Rejects if refactor_execution.status is already "completed"
  test("rejects with error when refactor_execution.status is already completed", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, { refactorExecutionStatus: "completed" });

    await withCwd(projectRoot, async () => {
      await expect(
        runExecuteRefactor(
          { provider: "claude" },
          { loadSkillFn: makeSkillFn() },
        ),
      ).rejects.toThrow("Cannot execute refactor: refactor_execution.status is already 'completed'.");
    });
  });

  // AC05: Rejects if refactor-prd.json is missing
  test("rejects with error when refactor-prd.json is missing", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot);

    await withCwd(projectRoot, async () => {
      await expect(
        runExecuteRefactor(
          { provider: "claude" },
          { loadSkillFn: makeSkillFn() },
        ),
      ).rejects.toThrow("Refactor PRD file missing: expected .agents/flow/it_000013_refactor-prd.json.");
    });
  });

  // AC05: Rejects on invalid JSON
  test("rejects with error when refactor-prd.json contains invalid JSON", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot);
    const prdPath = join(projectRoot, ".agents", "flow", "it_000013_refactor-prd.json");
    await writeFile(prdPath, "not-valid-json", "utf8");

    await withCwd(projectRoot, async () => {
      await expect(
        runExecuteRefactor(
          { provider: "claude" },
          { loadSkillFn: makeSkillFn() },
        ),
      ).rejects.toThrow("Invalid refactor PRD JSON in .agents/flow/it_000013_refactor-prd.json.");
    });
  });

  // AC05: Rejects on schema mismatch
  test("rejects with error when refactor-prd.json fails schema validation", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot);
    const prdPath = join(projectRoot, ".agents", "flow", "it_000013_refactor-prd.json");
    await writeFile(prdPath, JSON.stringify({ refactorItems: [] }), "utf8");

    await withCwd(projectRoot, async () => {
      await expect(
        runExecuteRefactor(
          { provider: "claude" },
          { loadSkillFn: makeSkillFn() },
        ),
      ).rejects.toThrow("Refactor PRD schema mismatch in .agents/flow/it_000013_refactor-prd.json.");
    });
  });

  // AC06: Sets refactor_execution.status = "in_progress" before processing
  test("sets refactor_execution.status to in_progress before invoking agent", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot);
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "Refactor A", description: "Do A", rationale: "Because A" },
    ]);

    let statusBeforeAgent: string | undefined;

    await withCwd(projectRoot, async () => {
      await runExecuteRefactor(
        { provider: "claude" },
        {
          loadSkillFn: makeSkillFn(),
          invokeAgentFn: async () => {
            const s = await readState(projectRoot);
            statusBeforeAgent = s.phases.refactor.refactor_execution.status;
            return makeAgentResult(0);
          },
        },
      );
    });

    expect(statusBeforeAgent).toBe("in_progress");
  });

  // AC07: Invokes agent with prompt built from skill and item fields
  test("invokes agent with prompt containing refactor item fields", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot);
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "My Title", description: "My Description", rationale: "My Rationale" },
    ]);

    const capturedPrompts: string[] = [];

    await withCwd(projectRoot, async () => {
      await runExecuteRefactor(
        { provider: "claude" },
        {
          loadSkillFn: makeSkillFn("SKILL_BODY"),
          invokeAgentFn: async (opts) => {
            capturedPrompts.push(opts.prompt);
            return makeAgentResult(0);
          },
        },
      );
    });

    expect(capturedPrompts).toHaveLength(1);
    expect(capturedPrompts[0]).toContain("SKILL_BODY");
    expect(capturedPrompts[0]).toContain("RI-001");
    expect(capturedPrompts[0]).toContain("My Title");
    expect(capturedPrompts[0]).toContain("My Description");
    expect(capturedPrompts[0]).toContain("My Rationale");
  });

  // AC08: Agent invoked in interactive mode
  test("invokes agent in interactive mode", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot);
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "T", description: "D", rationale: "R" },
    ]);

    const capturedOptions: Array<{ interactive?: boolean; provider: string }> = [];

    await withCwd(projectRoot, async () => {
      await runExecuteRefactor(
        { provider: "codex" },
        {
          loadSkillFn: makeSkillFn(),
          invokeAgentFn: async (opts) => {
            capturedOptions.push({ interactive: opts.interactive, provider: opts.provider });
            return makeAgentResult(0);
          },
        },
      );
    });

    expect(capturedOptions).toHaveLength(1);
    expect(capturedOptions[0].interactive).toBe(true);
    expect(capturedOptions[0].provider).toBe("codex");
  });

  // AC09 & AC10: Records result after each invocation, continues on failure
  test("records completed status and continues after each successful item", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot);
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "T1", description: "D1", rationale: "R1" },
      { id: "RI-002", title: "T2", description: "D2", rationale: "R2" },
    ]);

    const agentCallOrder: string[] = [];

    await withCwd(projectRoot, async () => {
      await runExecuteRefactor(
        { provider: "claude" },
        {
          loadSkillFn: makeSkillFn(),
          invokeAgentFn: async (opts) => {
            agentCallOrder.push(opts.prompt.includes("RI-001") ? "RI-001" : "RI-002");
            return makeAgentResult(0);
          },
        },
      );
    });

    expect(agentCallOrder).toEqual(["RI-001", "RI-002"]);

    const progressPath = join(projectRoot, ".agents", "flow", "it_000013_refactor-execution-progress.json");
    const progress = RefactorExecutionProgressSchema.parse(
      JSON.parse(await readFile(progressPath, "utf8")),
    );
    expect(progress.entries[0].status).toBe("completed");
    expect(progress.entries[1].status).toBe("completed");
  });

  // AC10: Non-zero exit code marks item as failed, continues to next
  test("marks item as failed on non-zero exit code and continues to next item", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot);
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "T1", description: "D1", rationale: "R1" },
      { id: "RI-002", title: "T2", description: "D2", rationale: "R2" },
    ]);

    const agentCallOrder: string[] = [];

    await withCwd(projectRoot, async () => {
      await runExecuteRefactor(
        { provider: "claude" },
        {
          loadSkillFn: makeSkillFn(),
          invokeAgentFn: async (opts) => {
            const id = opts.prompt.includes("RI-001") ? "RI-001" : "RI-002";
            agentCallOrder.push(id);
            // RI-001 fails, RI-002 succeeds
            return makeAgentResult(id === "RI-001" ? 1 : 0);
          },
        },
      );
    });

    // Both items are attempted
    expect(agentCallOrder).toEqual(["RI-001", "RI-002"]);

    const progressPath = join(projectRoot, ".agents", "flow", "it_000013_refactor-execution-progress.json");
    const progress = RefactorExecutionProgressSchema.parse(
      JSON.parse(await readFile(progressPath, "utf8")),
    );
    expect(progress.entries[0].status).toBe("failed");
    expect(progress.entries[0].agent_exit_code).toBe(1);
    expect(progress.entries[1].status).toBe("completed");
    expect(progress.entries[1].agent_exit_code).toBe(0);
  });

  // AC09: Progress file is written after each agent invocation
  test("writes progress file after each agent invocation", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot);
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "T1", description: "D1", rationale: "R1" },
      { id: "RI-002", title: "T2", description: "D2", rationale: "R2" },
    ]);

    const progressSnapshots: Array<ReturnType<typeof RefactorExecutionProgressSchema.parse>> = [];
    const progressPath = join(projectRoot, ".agents", "flow", "it_000013_refactor-execution-progress.json");

    await withCwd(projectRoot, async () => {
      await runExecuteRefactor(
        { provider: "claude" },
        {
          loadSkillFn: makeSkillFn(),
          invokeAgentFn: async (opts) => {
            const id = opts.prompt.includes("RI-001") ? "RI-001" : "RI-002";
            const result = makeAgentResult(id === "RI-001" ? 1 : 0);
            // Read the progress file after agent returns (before next iteration)
            return result;
          },
          writeFileFn: async (path, content, encoding) => {
            await writeFile(path, content as string, encoding as "utf8");
            // Capture progress after write
            if (path === progressPath) {
              const parsed = JSON.parse(content as string) as unknown;
              const validation = RefactorExecutionProgressSchema.safeParse(parsed);
              if (validation.success) {
                progressSnapshots.push(validation.data);
              }
            }
          },
        },
      );
    });

    // Two snapshots: one per item
    expect(progressSnapshots.length).toBeGreaterThanOrEqual(2);
    // After RI-001 write: RI-001 failed
    const afterRi001 = progressSnapshots.find((s) =>
      s.entries.some((e) => e.id === "RI-001" && e.status === "failed"),
    );
    expect(afterRi001).toBeDefined();
  });

  // AC11: All items complete → refactor_execution.status = "completed"
  test("sets refactor_execution.status to completed when all items succeed", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot);
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "T1", description: "D1", rationale: "R1" },
      { id: "RI-002", title: "T2", description: "D2", rationale: "R2" },
    ]);

    await withCwd(projectRoot, async () => {
      await runExecuteRefactor(
        { provider: "claude" },
        {
          loadSkillFn: makeSkillFn(),
          invokeAgentFn: async () => makeAgentResult(0),
        },
      );
    });

    const state = await readState(projectRoot);
    expect(state.phases.refactor.refactor_execution.status).toBe("completed");
  });

  // AC12: Any failure → status remains "in_progress"
  test("leaves refactor_execution.status as in_progress when any item fails", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot);
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "T1", description: "D1", rationale: "R1" },
      { id: "RI-002", title: "T2", description: "D2", rationale: "R2" },
    ]);

    await withCwd(projectRoot, async () => {
      await runExecuteRefactor(
        { provider: "claude" },
        {
          loadSkillFn: makeSkillFn(),
          invokeAgentFn: async (opts) => {
            // RI-001 fails
            return makeAgentResult(opts.prompt.includes("RI-001") ? 1 : 0);
          },
        },
      );
    });

    const state = await readState(projectRoot);
    expect(state.phases.refactor.refactor_execution.status).toBe("in_progress");
  });

  // AC13: refactor_execution.file is set to progress file name
  test("sets refactor_execution.file to the progress file name", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot);
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "T1", description: "D1", rationale: "R1" },
    ]);

    await withCwd(projectRoot, async () => {
      await runExecuteRefactor(
        { provider: "claude" },
        {
          loadSkillFn: makeSkillFn(),
          invokeAgentFn: async () => makeAgentResult(0),
        },
      );
    });

    const state = await readState(projectRoot);
    expect(state.phases.refactor.refactor_execution.file).toBe(
      "it_000013_refactor-execution-progress.json",
    );
  });

  // Full happy path: all items completed, state and progress correct
  test("happy path: all items completed, progress and state updated correctly", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot);
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "Refactor One", description: "First thing", rationale: "R1" },
      { id: "RI-002", title: "Refactor Two", description: "Second thing", rationale: "R2" },
    ]);

    const logs: string[] = [];

    await withCwd(projectRoot, async () => {
      await runExecuteRefactor(
        { provider: "claude" },
        {
          loadSkillFn: makeSkillFn(),
          invokeAgentFn: async () => makeAgentResult(0),
          logFn: (msg) => logs.push(msg),
          nowFn: () => new Date("2026-02-26T12:00:00.000Z"),
        },
      );
    });

    const state = await readState(projectRoot);
    expect(state.phases.refactor.refactor_execution.status).toBe("completed");
    expect(state.phases.refactor.refactor_execution.file).toBe(
      "it_000013_refactor-execution-progress.json",
    );
    expect(state.updated_by).toBe("nvst:execute-refactor");
    expect(state.last_updated).toBe("2026-02-26T12:00:00.000Z");

    const progressPath = join(projectRoot, ".agents", "flow", "it_000013_refactor-execution-progress.json");
    const progress = RefactorExecutionProgressSchema.parse(
      JSON.parse(await readFile(progressPath, "utf8")),
    );
    expect(progress.entries).toHaveLength(2);
    expect(progress.entries[0]).toMatchObject({ id: "RI-001", status: "completed", agent_exit_code: 0 });
    expect(progress.entries[1]).toMatchObject({ id: "RI-002", status: "completed", agent_exit_code: 0 });

    expect(logs).toContain("iteration=it_000013 item=RI-001 outcome=completed");
    expect(logs).toContain("iteration=it_000013 item=RI-002 outcome=completed");
    expect(logs).toContain("Refactor execution completed for all items.");
  });

  // AC02: Progress schema mismatch on resume rejects with clear error
  test("rejects with error when progress file schema is invalid on resume", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, { refactorExecutionStatus: "in_progress" });
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "T1", description: "D1", rationale: "R1" },
    ]);

    // Write a progress file with invalid schema (missing required fields)
    const progressPath = join(projectRoot, ".agents", "flow", "it_000013_refactor-execution-progress.json");
    await writeFile(
      progressPath,
      JSON.stringify({ entries: [{ id: "RI-001", bad_field: "value" }] }, null, 2) + "\n",
      "utf8",
    );

    await withCwd(projectRoot, async () => {
      await expect(
        runExecuteRefactor(
          { provider: "claude" },
          { loadSkillFn: makeSkillFn() },
        ),
      ).rejects.toThrow("Progress schema mismatch in .agents/flow/it_000013_refactor-execution-progress.json.");
    });
  });

  // AC04: Re-attempts items with "pending" status when resuming
  test("re-attempts pending items when resuming execution", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, { refactorExecutionStatus: "in_progress" });
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "T1", description: "D1", rationale: "R1" },
      { id: "RI-002", title: "T2", description: "D2", rationale: "R2" },
    ]);

    // Write a progress file with both items pending
    const progressPath = join(projectRoot, ".agents", "flow", "it_000013_refactor-execution-progress.json");
    await writeFile(
      progressPath,
      JSON.stringify({
        entries: [
          { id: "RI-001", title: "T1", status: "pending", agent_exit_code: null, updated_at: "2026-02-26T00:00:00.000Z" },
          { id: "RI-002", title: "T2", status: "pending", agent_exit_code: null, updated_at: "2026-02-26T00:00:00.000Z" },
        ],
      }, null, 2) + "\n",
      "utf8",
    );

    const invokedItems: string[] = [];

    await withCwd(projectRoot, async () => {
      await runExecuteRefactor(
        { provider: "claude" },
        {
          loadSkillFn: makeSkillFn(),
          invokeAgentFn: async (opts) => {
            invokedItems.push(opts.prompt.includes("RI-001") ? "RI-001" : "RI-002");
            return makeAgentResult(0);
          },
        },
      );
    });

    expect(invokedItems).toEqual(["RI-001", "RI-002"]);
  });

  // AC04: Re-attempts items with "failed" status when resuming
  test("re-attempts failed items when resuming execution", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, { refactorExecutionStatus: "in_progress" });
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "T1", description: "D1", rationale: "R1" },
      { id: "RI-002", title: "T2", description: "D2", rationale: "R2" },
    ]);

    // Write a progress file with RI-001 completed, RI-002 failed
    const progressPath = join(projectRoot, ".agents", "flow", "it_000013_refactor-execution-progress.json");
    await writeFile(
      progressPath,
      JSON.stringify({
        entries: [
          { id: "RI-001", title: "T1", status: "completed", agent_exit_code: 0, updated_at: "2026-02-26T00:00:00.000Z" },
          { id: "RI-002", title: "T2", status: "failed", agent_exit_code: 1, updated_at: "2026-02-26T00:00:00.000Z" },
        ],
      }, null, 2) + "\n",
      "utf8",
    );

    const invokedItems: string[] = [];

    await withCwd(projectRoot, async () => {
      await runExecuteRefactor(
        { provider: "claude" },
        {
          loadSkillFn: makeSkillFn(),
          invokeAgentFn: async (opts) => {
            invokedItems.push(opts.prompt.includes("RI-001") ? "RI-001" : "RI-002");
            return makeAgentResult(0);
          },
        },
      );
    });

    // Only RI-002 (failed) should be re-attempted; RI-001 (completed) is skipped
    expect(invokedItems).toEqual(["RI-002"]);
  });

  // AC05: Rejects when progress item IDs do not match refactor PRD item IDs
  test("rejects with error when progress item IDs do not match refactor PRD item IDs", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, { refactorExecutionStatus: "in_progress" });
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "T1", description: "D1", rationale: "R1" },
      { id: "RI-002", title: "T2", description: "D2", rationale: "R2" },
    ]);

    // Write a progress file with different IDs (stale/mismatched)
    const progressPath = join(projectRoot, ".agents", "flow", "it_000013_refactor-execution-progress.json");
    await writeFile(
      progressPath,
      JSON.stringify({
        entries: [
          { id: "RI-001", title: "T1", status: "completed", agent_exit_code: 0, updated_at: "2026-02-26T00:00:00.000Z" },
          { id: "RI-999", title: "STALE", status: "pending", agent_exit_code: null, updated_at: "2026-02-26T00:00:00.000Z" },
        ],
      }, null, 2) + "\n",
      "utf8",
    );

    await withCwd(projectRoot, async () => {
      await expect(
        runExecuteRefactor(
          { provider: "claude" },
          { loadSkillFn: makeSkillFn() },
        ),
      ).rejects.toThrow(
        "Refactor execution progress file out of sync: entry ids do not match refactor PRD item ids.",
      );
    });
  });

  // AC05: Rejects when progress has different number of items than PRD
  test("rejects with error when progress has different number of items than refactor PRD", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, { refactorExecutionStatus: "in_progress" });
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "T1", description: "D1", rationale: "R1" },
      { id: "RI-002", title: "T2", description: "D2", rationale: "R2" },
    ]);

    // Write a progress file with only one entry (missing RI-002)
    const progressPath = join(projectRoot, ".agents", "flow", "it_000013_refactor-execution-progress.json");
    await writeFile(
      progressPath,
      JSON.stringify({
        entries: [
          { id: "RI-001", title: "T1", status: "completed", agent_exit_code: 0, updated_at: "2026-02-26T00:00:00.000Z" },
        ],
      }, null, 2) + "\n",
      "utf8",
    );

    await withCwd(projectRoot, async () => {
      await expect(
        runExecuteRefactor(
          { provider: "claude" },
          { loadSkillFn: makeSkillFn() },
        ),
      ).rejects.toThrow(
        "Refactor execution progress file out of sync: entry ids do not match refactor PRD item ids.",
      );
    });
  });

  // Skips already-completed entries on re-run
  test("skips completed entries when resuming execution", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, { refactorExecutionStatus: "in_progress" });
    await writeRefactorPrd(projectRoot, "000013", [
      { id: "RI-001", title: "T1", description: "D1", rationale: "R1" },
      { id: "RI-002", title: "T2", description: "D2", rationale: "R2" },
    ]);

    // Write a pre-existing progress file with RI-001 already completed
    const progressPath = join(projectRoot, ".agents", "flow", "it_000013_refactor-execution-progress.json");
    await writeFile(
      progressPath,
      JSON.stringify({
        entries: [
          { id: "RI-001", title: "T1", status: "completed", agent_exit_code: 0, updated_at: "2026-02-26T00:00:00.000Z" },
          { id: "RI-002", title: "T2", status: "pending", agent_exit_code: null, updated_at: "2026-02-26T00:00:00.000Z" },
        ],
      }, null, 2) + "\n",
      "utf8",
    );

    const invokedItems: string[] = [];

    await withCwd(projectRoot, async () => {
      await runExecuteRefactor(
        { provider: "claude" },
        {
          loadSkillFn: makeSkillFn(),
          invokeAgentFn: async (opts) => {
            invokedItems.push(opts.prompt.includes("RI-001") ? "RI-001" : "RI-002");
            return makeAgentResult(0);
          },
        },
      );
    });

    // Only RI-002 should be invoked (RI-001 was already completed)
    expect(invokedItems).toEqual(["RI-002"]);
  });
});
