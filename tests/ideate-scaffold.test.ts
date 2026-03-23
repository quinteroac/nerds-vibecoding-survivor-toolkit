import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const NVST_SKILLS_SKILL_PATH = join(PROJECT_ROOT, "nvst-skills", "ideate", "SKILL.md");
const SOURCE_SKILL_PATH = join(PROJECT_ROOT, ".agents", "skills", "ideate", "SKILL.md");
const CLI_PATH = join(PROJECT_ROOT, "src", "cli.ts");

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCli(args: string[], cwd?: string): Promise<CliResult> {
  const proc = Bun.spawn([process.argv[0], CLI_PATH, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  await proc.exited;

  return {
    exitCode: proc.exitCode,
    stdout: await new Response(proc.stdout).text(),
    stderr: await new Response(proc.stderr).text(),
  };
}

describe("ideate scaffold template — US-003", () => {
  // AC01: nvst-skills/ideate/SKILL.md exists and mirrors .agents/skills/ideate/SKILL.md
  it("AC01: nvst-skills/ideate/SKILL.md exists and mirrors .agents/skills/ideate/SKILL.md", async () => {
    const [nvstSkillContent, sourceContent] = await Promise.all([
      readFile(NVST_SKILLS_SKILL_PATH, "utf8"),
      readFile(SOURCE_SKILL_PATH, "utf8"),
    ]);

    expect(nvstSkillContent.length).toBeGreaterThan(0);
    expect(nvstSkillContent).toBe(sourceContent);
  });

  // AC02: nvst init does not copy .agents/skills/ideate/SKILL.md (delegated to skills installer)
  it("AC02: nvst init does not create .agents/skills/ideate/SKILL.md (delegated to skills installer)", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "nvst-init-ideate-"));
    try {
      const result = await runCli(["init"], tempDir);

      expect(result.exitCode).toBe(0);

      // Skills are installed by the skills package, not by nvst init directly
      const outputSkillPath = join(tempDir, ".agents", "skills", "ideate", "SKILL.md");
      const { access } = await import("node:fs/promises");
      let exists = false;
      try {
        await access(outputSkillPath);
        exists = true;
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  // AC03: scaffold-manifest does NOT include the ideate template entry (it lives in nvst-skills)
  it("AC03: scaffold-manifest does not include the ideate template entry (lives in nvst-skills)", async () => {
    const { SCAFFOLD_FILES } = await import("../src/scaffold-manifest");
    const ideateEntry = SCAFFOLD_FILES.find((f) =>
      f.relativePath.includes("skills/ideate"),
    );

    expect(ideateEntry).toBeUndefined();
  });
});
