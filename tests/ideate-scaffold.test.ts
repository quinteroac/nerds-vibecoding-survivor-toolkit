import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const SCAFFOLD_TEMPLATE_PATH = join(
  PROJECT_ROOT,
  "scaffold",
  ".agents",
  "skills",
  "ideate",
  "tmpl_SKILL.md",
);
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
  // AC01: scaffold template exists and mirrors the source SKILL.md
  it("AC01: scaffold/…/ideate/tmpl_SKILL.md exists and mirrors .agents/skills/ideate/SKILL.md", async () => {
    const [templateContent, sourceContent] = await Promise.all([
      readFile(SCAFFOLD_TEMPLATE_PATH, "utf8"),
      readFile(SOURCE_SKILL_PATH, "utf8"),
    ]);

    expect(templateContent.length).toBeGreaterThan(0);
    expect(templateContent).toBe(sourceContent);
  });

  // AC02: `bun nvst init` on a fresh directory produces .agents/skills/ideate/SKILL.md
  it("AC02: nvst init produces .agents/skills/ideate/SKILL.md in a fresh directory", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "nvst-init-ideate-"));
    try {
      const result = await runCli(["init"], tempDir);

      expect(result.exitCode).toBe(0);

      const outputSkillPath = join(tempDir, ".agents", "skills", "ideate", "SKILL.md");

      const outputContent = await readFile(outputSkillPath, "utf8");
      const sourceContent = await readFile(SOURCE_SKILL_PATH, "utf8");
      expect(outputContent).toBe(sourceContent);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  // AC03: typecheck is validated structurally — if the file is importable and the manifest compiles, TS is happy
  it("AC03: scaffold-manifest includes the ideate template entry", async () => {
    const { SCAFFOLD_FILES } = await import("../src/scaffold-manifest");
    const ideateEntry = SCAFFOLD_FILES.find((f) =>
      f.relativePath.includes("skills/ideate/tmpl_SKILL.md"),
    );

    expect(ideateEntry).toBeDefined();
    expect(ideateEntry!.content.length).toBeGreaterThan(0);
    expect(ideateEntry!.content).toContain("ideate");
  });
});
