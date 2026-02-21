import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TestPlanSchema } from "../../scaffold/schemas/tmpl_test-plan";
import { readState, writeState } from "../state";
import { runApproveTestPlan } from "./approve-test-plan";

async function createProjectRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-approve-test-plan-"));
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
  status: "pending" | "pending_approval" | "created",
  file: string | null,
) {
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
        project_context: { status: "created", file: ".agents/PROJECT_CONTEXT.md" },
        test_plan: { status, file },
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
    last_updated: "2026-02-21T00:00:00.000Z",
    updated_by: "seed",
    history: [],
  });
}

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("approve test-plan command", () => {
  test("registers approve test-plan command in CLI dispatch", async () => {
    const source = await readFile(join(process.cwd(), "src", "cli.ts"), "utf8");

    expect(source).toContain('import { runApproveTestPlan } from "./commands/approve-test-plan";');
    expect(source).toContain('if (subcommand === "test-plan") {');
    expect(source).toContain("await runApproveTestPlan();");
  });

  test("requires test_plan.status to be pending_approval", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, "pending", "it_000003_test-plan.md");

    await withCwd(projectRoot, async () => {
      await expect(runApproveTestPlan()).rejects.toThrow(
        "Cannot approve test plan from status 'pending'. Expected pending_approval.",
      );
    });
  });

  test("approves test plan, generates TP JSON via write-json, and updates state fields", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);
    await seedState(projectRoot, "pending_approval", "it_000003_test-plan.md");

    const testPlanPath = join(projectRoot, ".agents", "flow", "it_000003_test-plan.md");
    await writeFile(
      testPlanPath,
      [
        "# Test plan - Iteration 000003",
        "## Scope",
        "- Validate login",
        "## Automated tests",
        "- Unit test auth",
        "## Exploratory / manual tests",
        "- Browser smoke",
        "## Environment and data",
        "- staging + seeded user",
      ].join("\n"),
      "utf8",
    );

    let capturedSchema = "";
    let capturedOutPath = "";
    let capturedPayload = "";

    await withCwd(projectRoot, async () => {
      await runApproveTestPlan({
        invokeWriteJsonFn: async (_root, schemaName, outPath, data) => {
          capturedSchema = schemaName;
          capturedOutPath = outPath;
          capturedPayload = data;
          await writeFile(join(projectRoot, outPath), data, "utf8");
          return { exitCode: 0, stderr: "" };
        },
        nowFn: () => new Date("2026-02-21T05:00:00.000Z"),
      });
    });

    expect(capturedSchema).toBe("test-plan");
    expect(capturedOutPath).toBe(".agents/flow/it_000003_TP.json");

    const parsedPayload = JSON.parse(capturedPayload) as unknown;
    const validation = TestPlanSchema.safeParse(parsedPayload);
    expect(validation.success).toBe(true);
    if (!validation.success) {
      throw new Error("Expected test-plan payload to be valid");
    }
    expect(validation.data.scope).toEqual(["Validate login"]);
    expect(validation.data.automatedTests).toEqual(["Unit test auth"]);
    expect(validation.data.exploratoryManualTests).toEqual(["Browser smoke"]);
    expect(validation.data.environmentAndData).toEqual(["staging + seeded user"]);

    const state = await readState(projectRoot);
    expect(state.phases.prototype.test_plan.status).toBe("created");
    expect(state.phases.prototype.tp_generation.status).toBe("created");
    expect(state.phases.prototype.tp_generation.file).toBe("it_000003_TP.json");
    expect(state.last_updated).toBe("2026-02-21T05:00:00.000Z");
    expect(state.updated_by).toBe("nvst:approve-test-plan");
  });
});
