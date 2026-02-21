import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AgentResult } from "../agent";
import { readState, writeState } from "../state";
import { runCreateTestPlan } from "./create-test-plan";

async function createProjectRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-create-test-plan-"));
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

async function seedState(projectRoot: string, projectContextStatus: "pending" | "pending_approval" | "created") {
  await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });

  await writeState(projectRoot, {
    current_iteration: "000003",
    current_phase: "prototype",
    phases: {
      define: {
        requirement_definition: { status: "approved", file: "it_000003_product-requirement-document.md" },
        prd_generation: { status: "completed", file: "it_000003_PRD.json" },
      },
      prototype: {
        project_context: { status: projectContextStatus, file: ".agents/PROJECT_CONTEXT.md" },
        test_plan: { status: "pending", file: null },
        tp_generation: { status: "pending", file: null },
        prototype_build: { status: "pending", file: null },
        prototype_approved: false,
      },
      refactor: {
        evaluation_report: { status: "pending", file: null },
        refactor_plan: { status: "pending", file: null },
        refactor_execution: { status: "pending", file: null },
        changelog: { status: "pending", file: null },
      },
    },
    last_updated: "2026-02-20T00:00:00.000Z",
    updated_by: "seed",
    history: [],
  });

  await writeFile(join(projectRoot, ".agents", "PROJECT_CONTEXT.md"), "# Context\n", "utf8");
}

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("create test-plan command", () => {
  test("registers create test-plan command in CLI dispatch", async () => {
    const source = await readFile(join(process.cwd(), "src", "cli.ts"), "utf8");

    expect(source).toContain('import { runCreateTestPlan } from "./commands/create-test-plan";');
    expect(source).toContain('if (subcommand === "test-plan") {');
    expect(source).toContain("await runCreateTestPlan({ provider, force });");
  });

  test("loads create-test-plan skill, invokes agent interactively with iteration context, writes state", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, "created");

    let loadedSkill = "";
    let invocation: { interactive: boolean | undefined; prompt: string } | undefined;
    const outputPath = join(projectRoot, ".agents", "flow", "it_000003_test-plan.md");

    await withCwd(projectRoot, async () => {
      await runCreateTestPlan(
        { provider: "codex" },
        {
          loadSkillFn: async (_root, skillName) => {
            loadedSkill = skillName;
            return "Create test plan skill";
          },
          invokeAgentFn: async (options): Promise<AgentResult> => {
            invocation = {
              interactive: options.interactive,
              prompt: options.prompt,
            };
            await writeFile(outputPath, "# Test Plan\n", "utf8");
            return { exitCode: 0, stdout: "", stderr: "" };
          },
          nowFn: () => new Date("2026-02-21T03:00:00.000Z"),
        },
      );
    });

    expect(loadedSkill).toBe("create-test-plan");
    if (invocation === undefined) {
      throw new Error("Agent invocation was not captured");
    }
    expect(invocation.interactive).toBe(true);
    expect(invocation.prompt).toContain("### iteration");
    expect(invocation.prompt).toContain("000003");

    const content = await readFile(outputPath, "utf8");
    expect(content).toContain("# Test Plan");

    const state = await readState(projectRoot);
    expect(state.phases.prototype.test_plan.status).toBe("pending_approval");
    expect(state.phases.prototype.test_plan.file).toBe("it_000003_test-plan.md");
    expect(state.last_updated).toBe("2026-02-21T03:00:00.000Z");
    expect(state.updated_by).toBe("nvst:create-test-plan");
  });

  test("requires project_context.status to be created", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, "pending");

    await withCwd(projectRoot, async () => {
      await expect(
        runCreateTestPlan(
          { provider: "codex" },
          {
            loadSkillFn: async () => "unused",
            invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
          },
        ),
      ).rejects.toThrow("Cannot create test plan: prototype.project_context.status must be created");
    });
  });

  test("asks for confirmation before overwrite and cancels when denied", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, "created");

    const outputPath = join(projectRoot, ".agents", "flow", "it_000003_test-plan.md");
    await writeFile(outputPath, "old", "utf8");

    let confirmCalls = 0;
    let invokeCalls = 0;

    await withCwd(projectRoot, async () => {
      await runCreateTestPlan(
        { provider: "codex" },
        {
          confirmOverwriteFn: async () => {
            confirmCalls += 1;
            return false;
          },
          loadSkillFn: async () => "unused",
          invokeAgentFn: async () => {
            invokeCalls += 1;
            return { exitCode: 0, stdout: "", stderr: "" };
          },
        },
      );
    });

    expect(confirmCalls).toBe(1);
    expect(invokeCalls).toBe(0);

    const state = await readState(projectRoot);
    expect(state.phases.prototype.test_plan.status).toBe("pending");
    expect(state.phases.prototype.test_plan.file).toBeNull();
  });

  test("force overwrite bypasses confirmation", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, "created");

    const outputPath = join(projectRoot, ".agents", "flow", "it_000003_test-plan.md");
    await writeFile(outputPath, "old", "utf8");

    let confirmCalled = false;
    let invokeCalls = 0;

    await withCwd(projectRoot, async () => {
      await runCreateTestPlan(
        { provider: "codex", force: true },
        {
          confirmOverwriteFn: async () => {
            confirmCalled = true;
            return true;
          },
          loadSkillFn: async () => "skill",
          invokeAgentFn: async () => {
            invokeCalls += 1;
            await writeFile(outputPath, "new", "utf8");
            return { exitCode: 0, stdout: "", stderr: "" };
          },
        },
      );
    });

    expect(confirmCalled).toBe(false);
    expect(invokeCalls).toBe(1);
    expect(await readFile(outputPath, "utf8")).toBe("new");
  });
});
