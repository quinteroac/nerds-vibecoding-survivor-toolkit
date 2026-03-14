import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const CLI_PATH = join(PROJECT_ROOT, "src", "cli.ts");
const RECOVERED_SKILL_HASH = "92f975bcc3749648788c6f966ed1ac3321f3df4851e9769ddee28d2caa9fd5af";

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

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

  const recoveredSkill = await readFile(
    join(PROJECT_ROOT, ".agents", "skills", "refine-project-context", "SKILL.md"),
    "utf8",
  );

  await writeFile(
    join(projectRoot, ".agents", "skills", "refine-project-context", "SKILL.md"),
    recoveredSkill,
    "utf8",
  );

  return projectRoot;
}

describe("refine-project-context skill recovery", () => {

  it("provides the scaffold mirror for refine-project-context skill", async () => {
    const runtimeSkillPath = join(
      PROJECT_ROOT,
      ".agents",
      "skills",
      "refine-project-context",
      "SKILL.md",
    );
    const scaffoldSkillPath = join(
      PROJECT_ROOT,
      "scaffold",
      ".agents",
      "skills",
      "refine-project-context",
      "tmpl_SKILL.md",
    );

    const [runtimeSkill, scaffoldSkill] = await Promise.all([
      readFile(runtimeSkillPath, "utf8"),
      readFile(scaffoldSkillPath, "utf8"),
    ]);

    expect(scaffoldSkill.length).toBeGreaterThan(0);
    expect(scaffoldSkill).toBe(runtimeSkill);
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
