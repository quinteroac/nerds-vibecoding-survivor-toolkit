import { describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const CLI_PATH = join(PROJECT_ROOT, "src", "cli.ts");
const BUNDLED_REFINE_PROJECT_CONTEXT_SKILL = join(
  PROJECT_ROOT,
  "nvst-skills",
  "refine-project-context",
  "SKILL.md",
);

function createBaseState(): Record<string, unknown> {
  return {
    current_iteration: "000001",
    current_phase: "prototype",
    phases: {
      define: {
        requirement_definition: {
          status: "approved",
          file: "it_000001_product-requirement-document.md",
        },
        prd_generation: {
          status: "completed",
          file: "it_000001_product-requirement-document.md",
        },
      },
      prototype: {
        prototype_creation: { status: "pending", file: null },
        prototype_audit: { status: "pending", file: null },
        prototype_refactor: { status: "pending", file: null },
        prototype_approval: { status: "pending", file: null },
        project_context: { status: "created", file: ".agents/PROJECT_CONTEXT.md" },
      },
      refactor: {},
    },
    last_updated: "2026-01-01T00:00:00.000Z",
    history: [],
  };
}

async function createTempProjectWithRecoveredSkill(): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), "nvst-refine-project-context-"));
  await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });
  await mkdir(join(projectRoot, ".agents", "skills", "refine-project-context"), {
    recursive: true,
  });

  const state = createBaseState();
  await writeFile(join(projectRoot, ".agents", "state.json"), JSON.stringify(state, null, 2), "utf8");
  await writeFile(join(projectRoot, ".agents", "PROJECT_CONTEXT.md"), "# Project Context\n", "utf8");

  const recoveredSkill = await readFile(BUNDLED_REFINE_PROJECT_CONTEXT_SKILL, "utf8");

  await writeFile(
    join(projectRoot, ".agents", "skills", "refine-project-context", "SKILL.md"),
    recoveredSkill,
    "utf8",
  );

  return projectRoot;
}

describe("refine-project-context skill recovery", () => {

  it("bundles refine-project-context skill under nvst-skills/", async () => {
    const skill = await readFile(BUNDLED_REFINE_PROJECT_CONTEXT_SKILL, "utf8");

    expect(skill.length).toBeGreaterThan(0);
    expect(skill.toLowerCase()).toContain("project context");
  });

  it("runs `nvst refine project-context --agent ide` without missing skill errors", async () => {
    const projectRoot = await createTempProjectWithRecoveredSkill();

    try {
      const proc = Bun.spawn([process.argv[0], CLI_PATH, "refine", "project-context", "--agent", "ide"], {
        cwd: projectRoot,
        stdout: "pipe",
        stderr: "pipe",
      });

      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();

      expect(proc.exitCode).toBe(0);
      expect(stderr).not.toContain("Skill 'refine-project-context' not found");
      expect(stdout).toContain("Project context refined and marked as pending approval.");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
