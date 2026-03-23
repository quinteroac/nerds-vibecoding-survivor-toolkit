import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";

const PROJECT_ROOT = join(import.meta.dir, "..");
const CLI_PATH = join(PROJECT_ROOT, "src", "cli.ts");
const NVST_SKILLS_DIR = join(PROJECT_ROOT, "nvst-skills");

const IMPECCABLE_SKILLS = [
  "adapt",
  "animate",
  "audit",
  "bolder",
  "clarify",
  "colorize",
  "critique",
  "delight",
  "distill",
  "extract",
  "frontend-design",
  "harden",
  "normalize",
  "onboard",
  "optimize",
  "polish",
  "quieter",
  "teach-impeccable",
] as const;

const FRONTEND_DESIGN_REFERENCE_FILES = [
  "color-and-contrast.md",
  "interaction-design.md",
  "motion-design.md",
  "responsive-design.md",
  "spatial-design.md",
  "typography.md",
  "ux-writing.md",
] as const;

// Hashes from upstream pbakaus/impeccable commit 3c3ee6b4f244bf522ecadf2ae9dd0e688d195ed8.
const EXPECTED_SHA256: Record<string, string> = {
  "adapt/SKILL.md": "a97c49f51b0d20229369eabb5b02dbbb6fcbf4316fc659bc3f931b2d2b9accf3",
  "animate/SKILL.md": "c380011a9dc1fbf8db38379f18fde647a5922ebd105404fcc15e531c03dfae62",
  "audit/SKILL.md": "7caba2be9e2ce1bc11fb8635406a7e67ee8a296a52ee59848e02c2ef60531a0c",
  "bolder/SKILL.md": "19de72962ff38f42cf4d61a4f5c3e2b52f06a52b7c2225472d66f5d0261fb0e4",
  "clarify/SKILL.md": "c264b79a063abfeb483471cc95e317f4b95f06fbc4a18c9b697b466c7edc18f0",
  "colorize/SKILL.md": "c239bcdbe70d9be673fd6347ac08db802f1e4ed1db48a33d642f6a3ae05a906e",
  "critique/SKILL.md": "f615589febd39710901817be9d8673c6ed2d8a3123ebdf2e6e87785a1390b52d",
  "delight/SKILL.md": "bbaca26d0c8e1c34d35d602e9607609473898cb914d1411fe554f4b5db524b8e",
  "distill/SKILL.md": "b60b607794a22644c6f2363a534580df90213fa6b13683620bfa2716eb836fe7",
  "extract/SKILL.md": "9e47fa5ef6be6960adc46fc91d80af7fc748780ac11605d625bcaf225427572b",
  "frontend-design/SKILL.md": "1281e529c4d7cfc058f3857c493976f1299c87a285f53ebe0cb2afbd4840a71f",
  "harden/SKILL.md": "4756b3f0365de089e7d4dd5a67f813df32a487a5cd2cf4793a32a58a04938a7b",
  "normalize/SKILL.md": "7a2e99550b52b0c6b859e086cab38b66db3823df26f52dfe829cc206b7f8eeca",
  "onboard/SKILL.md": "e9ebc0c5c15bb27437b2473152f8beab5fcc53c705607995a675285bc37e34ac",
  "optimize/SKILL.md": "34a1d0ea8ca6756e0f3f95ad0fb7870dba4c7fb341ea3a582d17268672783acc",
  "polish/SKILL.md": "20961487777bdb75f740c4ce6d7651968196ae80f424ce92bcfe4edfb010020b",
  "quieter/SKILL.md": "1ebb6399c10bfb14f79a07de470f940da6ed2514720623118ade23bbdec42c69",
  "teach-impeccable/SKILL.md": "84b8ca27d9ea3f53c146cb5d9697c8aca9b7da166e8e5b4ca87feb2423f3dd50",
  "frontend-design/reference/color-and-contrast.md":
    "be502ad08270cd60cabb6769a6e1ed517ecaeeb7d40f6e610f1802689ee78ddc",
  "frontend-design/reference/interaction-design.md":
    "997d5e66ae54fcf8e59a0fcf0a2db49982ffe7b9b6cc091bcf64a3b3e0828ed7",
  "frontend-design/reference/motion-design.md":
    "c35a59b5f795721c914cfccf9b470e89a5010c563cd85ab46a67031531678f3f",
  "frontend-design/reference/responsive-design.md":
    "5add44195a42cf7fa82aecadaad79b8875446b930e06d087d73f3722533fd95a",
  "frontend-design/reference/spatial-design.md":
    "10c743ee8245fc1be9e8af2b79dd08b0dae19fcde33d46c9730c000d7e13b7cd",
  "frontend-design/reference/typography.md":
    "71c2e62adf8dff3e3a6f57c37c72e5ca6c1e2902b906915c74d3cc04ab72c3c1",
  "frontend-design/reference/ux-writing.md":
    "0cd5e958d92be6e2331cb199d6ed5d98597aa20ec4922d4c3df56e7753cfc00c",
};

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
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

describe("Impeccable skill scaffold templates — US-001", () => {
  it("AC01: all 18 Impeccable skill SKILL.md files exist in nvst-skills/", async () => {
    for (const skill of IMPECCABLE_SKILLS) {
      const skillPath = join(NVST_SKILLS_DIR, skill, "SKILL.md");
      const content = await readFile(skillPath, "utf8");
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it("AC02: frontend-design reference files exist in nvst-skills/frontend-design/reference/", async () => {
    for (const fileName of FRONTEND_DESIGN_REFERENCE_FILES) {
      const referencePath = join(NVST_SKILLS_DIR, "frontend-design", "reference", fileName);
      const content = await readFile(referencePath, "utf8");
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it("AC03: nvst-skills/ Impeccable files match upstream verbatim content hashes", async () => {
    for (const [relativePath, expectedHash] of Object.entries(EXPECTED_SHA256)) {
      const skillPath = join(NVST_SKILLS_DIR, relativePath);
      const content = await readFile(skillPath, "utf8");
      expect(sha256(content)).toBe(expectedHash);
    }
  });

  it("AC04: scaffold-manifest does not include Impeccable skill entries (they live in nvst-skills)", async () => {
    const { SCAFFOLD_FILES } = await import("../src/scaffold-manifest");
    const manifestPaths = SCAFFOLD_FILES.map((entry) => entry.relativePath);

    for (const skill of IMPECCABLE_SKILLS) {
      expect(manifestPaths.some((p) => p.includes(`skills/${skill}`))).toBe(false);
    }
  });

  it("AC05: nvst init does not copy Impeccable skill files (delegated to skills installer)", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "nvst-init-impeccable-"));
    try {
      const result = await runCli(["init"], tempDir);
      expect(result.exitCode).toBe(0);

      // Skill files are NOT created by nvst init itself — the skills installer handles that
      const { access } = await import("node:fs/promises");
      for (const skill of IMPECCABLE_SKILLS) {
        const skillPath = join(tempDir, ".agents", "skills", skill, "SKILL.md");
        let exists = false;
        try {
          await access(skillPath);
          exists = true;
        } catch {
          exists = false;
        }
        expect(exists).toBe(false);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("AC06: nvst init run a second time does not emit 'Skipping existing file' for Impeccable skill files", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "nvst-init-impeccable-skip-"));
    try {
      const firstRun = await runCli(["init"], tempDir);
      expect(firstRun.exitCode).toBe(0);

      const secondRun = await runCli(["init"], tempDir);
      expect(secondRun.exitCode).toBe(0);
      // Skill files are managed by the skills installer, not by init, so no "Skipping" messages for them
      expect(secondRun.stderr).not.toContain("Skipping existing file: .agents/skills/adapt/SKILL.md");
      expect(secondRun.stderr).not.toContain(
        "Skipping existing file: .agents/skills/frontend-design/reference/typography.md",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
