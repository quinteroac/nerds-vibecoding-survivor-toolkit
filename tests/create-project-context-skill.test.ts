import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const CLI_PATH = join(PROJECT_ROOT, "src", "cli.ts");
const RECOVERED_SKILL_HASH = "1a6a93a8f20dd63e09e0b3cebf029b1872eb638df98998b2112ab7d788b10237";

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function createBaseState(): Record<string, unknown> {
  return {
    current_iteration: "000001",
    current_phase: "define",
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
        project_context: { status: "pending", file: null },
      },
      refactor: {},
    },
    last_updated: "2026-01-01T00:00:00.000Z",
    history: [],
  };
}

async function createTempProjectWithRecoveredSkill(opts?: { includeAgentsMd?: boolean }): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), "nvst-create-project-context-"));
  await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });
  await mkdir(join(projectRoot, ".agents", "skills", "create-project-context"), {
    recursive: true,
  });

  const state = createBaseState();
  await writeFile(join(projectRoot, ".agents", "state.json"), JSON.stringify(state, null, 2), "utf8");
  await writeFile(
    join(projectRoot, ".agents", "flow", "it_000001_product-requirement-document.md"),
    "# PRD\n\n## Goals\n- Keep context current",
    "utf8",
  );

  const recoveredSkill = await readFile(
    join(PROJECT_ROOT, ".agents", "skills", "create-project-context", "SKILL.md"),
    "utf8",
  );

  await writeFile(
    join(projectRoot, ".agents", "skills", "create-project-context", "SKILL.md"),
    recoveredSkill,
    "utf8",
  );
  if (opts?.includeAgentsMd) {
    await writeFile(
      join(projectRoot, "AGENTS.md"),
      "# Agent Entry Point\n\nAlways keep project context aligned.\n",
      "utf8",
    );
  }

  return projectRoot;
}

describe("create-project-context skill recovery", () => {
  it("keeps the recovered create-project-context skill content from commit 8f1c14f", async () => {
    const skillPath = join(PROJECT_ROOT, ".agents", "skills", "create-project-context", "SKILL.md");
    const content = await readFile(skillPath, "utf8");

    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("`AGENTS.md` (if present)");
    expect(sha256(content)).toBe(RECOVERED_SKILL_HASH);
  });

  it("provides the scaffold mirror for create-project-context skill", async () => {
    const runtimeSkillPath = join(
      PROJECT_ROOT,
      ".agents",
      "skills",
      "create-project-context",
      "SKILL.md",
    );
    const scaffoldSkillPath = join(
      PROJECT_ROOT,
      "scaffold",
      ".agents",
      "skills",
      "create-project-context",
      "tmpl_SKILL.md",
    );

    const [runtimeSkill, scaffoldSkill] = await Promise.all([
      readFile(runtimeSkillPath, "utf8"),
      readFile(scaffoldSkillPath, "utf8"),
    ]);

    expect(scaffoldSkill.length).toBeGreaterThan(0);
    expect(scaffoldSkill).toBe(runtimeSkill);
  });

  it("runs `nvst create project-context --agent ide` without missing skill errors", async () => {
    const projectRoot = await createTempProjectWithRecoveredSkill();

    try {
      const proc = Bun.spawn([process.argv[0], CLI_PATH, "create", "project-context", "--agent", "ide"], {
        cwd: projectRoot,
        stdout: "pipe",
        stderr: "pipe",
      });

      await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();

      expect(proc.exitCode).toBe(0);
      expect(stderr).not.toContain("Skill 'create-project-context' not found");
      expect(stdout).not.toContain("### agents_md");
      expect(stdout).toContain("Project context generated and marked as pending approval.");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("includes AGENTS.md content in prompt context when AGENTS.md exists", async () => {
    const projectRoot = await createTempProjectWithRecoveredSkill({ includeAgentsMd: true });

    try {
      const proc = Bun.spawn([process.argv[0], CLI_PATH, "create", "project-context", "--agent", "ide"], {
        cwd: projectRoot,
        stdout: "pipe",
        stderr: "pipe",
      });

      await proc.exited;
      const stdout = await new Response(proc.stdout).text();

      expect(proc.exitCode).toBe(0);
      expect(stdout).toContain("### agents_md");
      expect(stdout).toContain("# Agent Entry Point");
      expect(stdout).toContain("Always keep project context aligned.");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
