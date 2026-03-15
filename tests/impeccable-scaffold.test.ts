import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { describe, expect, it } from "bun:test";

const PROJECT_ROOT = join(import.meta.dir, "..");
const CLI_PATH = join(PROJECT_ROOT, "src", "cli.ts");

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

const FRONTEND_DESIGN_REFERENCE_TEMPLATES = [
  "tmpl_color-and-contrast.md",
  "tmpl_interaction-design.md",
  "tmpl_motion-design.md",
  "tmpl_responsive-design.md",
  "tmpl_spatial-design.md",
  "tmpl_typography.md",
  "tmpl_ux-writing.md",
] as const;

const TEMPLATE_RELATIVE_PATHS = [
  ...IMPECCABLE_SKILLS.map((skill) => `.agents/skills/${skill}/tmpl_SKILL.md`),
  ...FRONTEND_DESIGN_REFERENCE_TEMPLATES.map(
    (name) => `.agents/skills/frontend-design/reference/${name}`,
  ),
];

// Hashes from upstream pbakaus/impeccable commit 3c3ee6b4f244bf522ecadf2ae9dd0e688d195ed8.
const EXPECTED_SHA256: Record<string, string> = {
  ".agents/skills/adapt/tmpl_SKILL.md": "a97c49f51b0d20229369eabb5b02dbbb6fcbf4316fc659bc3f931b2d2b9accf3",
  ".agents/skills/animate/tmpl_SKILL.md":
    "c380011a9dc1fbf8db38379f18fde647a5922ebd105404fcc15e531c03dfae62",
  ".agents/skills/audit/tmpl_SKILL.md": "7caba2be9e2ce1bc11fb8635406a7e67ee8a296a52ee59848e02c2ef60531a0c",
  ".agents/skills/bolder/tmpl_SKILL.md":
    "19de72962ff38f42cf4d61a4f5c3e2b52f06a52b7c2225472d66f5d0261fb0e4",
  ".agents/skills/clarify/tmpl_SKILL.md":
    "c264b79a063abfeb483471cc95e317f4b95f06fbc4a18c9b697b466c7edc18f0",
  ".agents/skills/colorize/tmpl_SKILL.md":
    "c239bcdbe70d9be673fd6347ac08db802f1e4ed1db48a33d642f6a3ae05a906e",
  ".agents/skills/critique/tmpl_SKILL.md":
    "f615589febd39710901817be9d8673c6ed2d8a3123ebdf2e6e87785a1390b52d",
  ".agents/skills/delight/tmpl_SKILL.md":
    "bbaca26d0c8e1c34d35d602e9607609473898cb914d1411fe554f4b5db524b8e",
  ".agents/skills/distill/tmpl_SKILL.md":
    "b60b607794a22644c6f2363a534580df90213fa6b13683620bfa2716eb836fe7",
  ".agents/skills/extract/tmpl_SKILL.md":
    "9e47fa5ef6be6960adc46fc91d80af7fc748780ac11605d625bcaf225427572b",
  ".agents/skills/frontend-design/tmpl_SKILL.md":
    "1281e529c4d7cfc058f3857c493976f1299c87a285f53ebe0cb2afbd4840a71f",
  ".agents/skills/harden/tmpl_SKILL.md":
    "4756b3f0365de089e7d4dd5a67f813df32a487a5cd2cf4793a32a58a04938a7b",
  ".agents/skills/normalize/tmpl_SKILL.md":
    "7a2e99550b52b0c6b859e086cab38b66db3823df26f52dfe829cc206b7f8eeca",
  ".agents/skills/onboard/tmpl_SKILL.md":
    "e9ebc0c5c15bb27437b2473152f8beab5fcc53c705607995a675285bc37e34ac",
  ".agents/skills/optimize/tmpl_SKILL.md":
    "34a1d0ea8ca6756e0f3f95ad0fb7870dba4c7fb341ea3a582d17268672783acc",
  ".agents/skills/polish/tmpl_SKILL.md":
    "20961487777bdb75f740c4ce6d7651968196ae80f424ce92bcfe4edfb010020b",
  ".agents/skills/quieter/tmpl_SKILL.md":
    "1ebb6399c10bfb14f79a07de470f940da6ed2514720623118ade23bbdec42c69",
  ".agents/skills/teach-impeccable/tmpl_SKILL.md":
    "84b8ca27d9ea3f53c146cb5d9697c8aca9b7da166e8e5b4ca87feb2423f3dd50",
  ".agents/skills/frontend-design/reference/tmpl_color-and-contrast.md":
    "be502ad08270cd60cabb6769a6e1ed517ecaeeb7d40f6e610f1802689ee78ddc",
  ".agents/skills/frontend-design/reference/tmpl_interaction-design.md":
    "997d5e66ae54fcf8e59a0fcf0a2db49982ffe7b9b6cc091bcf64a3b3e0828ed7",
  ".agents/skills/frontend-design/reference/tmpl_motion-design.md":
    "c35a59b5f795721c914cfccf9b470e89a5010c563cd85ab46a67031531678f3f",
  ".agents/skills/frontend-design/reference/tmpl_responsive-design.md":
    "5add44195a42cf7fa82aecadaad79b8875446b930e06d087d73f3722533fd95a",
  ".agents/skills/frontend-design/reference/tmpl_spatial-design.md":
    "10c743ee8245fc1be9e8af2b79dd08b0dae19fcde33d46c9730c000d7e13b7cd",
  ".agents/skills/frontend-design/reference/tmpl_typography.md":
    "71c2e62adf8dff3e3a6f57c37c72e5ca6c1e2902b906915c74d3cc04ab72c3c1",
  ".agents/skills/frontend-design/reference/tmpl_ux-writing.md":
    "0cd5e958d92be6e2331cb199d6ed5d98597aa20ec4922d4c3df56e7753cfc00c",
};

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function toOutputRelativePath(templateRelativePath: string): string {
  const fileName = basename(templateRelativePath);
  const outputFileName = fileName.startsWith("tmpl_") ? fileName.slice("tmpl_".length) : fileName;
  return join(dirname(templateRelativePath), outputFileName);
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
  it("AC01: all 18 Impeccable skill templates exist with tmpl_ prefix", async () => {
    for (const skill of IMPECCABLE_SKILLS) {
      const templatePath = join(PROJECT_ROOT, "scaffold", ".agents", "skills", skill, "tmpl_SKILL.md");
      const content = await readFile(templatePath, "utf8");
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it("AC02: frontend-design reference template files exist in scaffold", async () => {
    for (const templateName of FRONTEND_DESIGN_REFERENCE_TEMPLATES) {
      const referencePath = join(
        PROJECT_ROOT,
        "scaffold",
        ".agents",
        "skills",
        "frontend-design",
        "reference",
        templateName,
      );
      const content = await readFile(referencePath, "utf8");
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it("AC03: scaffolded Impeccable files match upstream verbatim content hashes", async () => {
    for (const relativePath of TEMPLATE_RELATIVE_PATHS) {
      const templatePath = join(PROJECT_ROOT, "scaffold", relativePath);
      const content = await readFile(templatePath, "utf8");
      expect(sha256(content)).toBe(EXPECTED_SHA256[relativePath]);
    }
  });

  it("AC04: scaffold-manifest includes all Impeccable template entries", async () => {
    const { SCAFFOLD_FILES } = await import("../src/scaffold-manifest");
    const manifestPaths = new Set(SCAFFOLD_FILES.map((entry) => entry.relativePath));

    for (const relativePath of TEMPLATE_RELATIVE_PATHS) {
      expect(manifestPaths.has(relativePath)).toBe(true);
    }
  });

  it("AC05: nvst init creates each Impeccable skill and reference file in a clean directory", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "nvst-init-impeccable-"));
    try {
      const result = await runCli(["init"], tempDir);
      expect(result.exitCode).toBe(0);

      for (const templateRelativePath of TEMPLATE_RELATIVE_PATHS) {
        const outputRelativePath = toOutputRelativePath(templateRelativePath);
        const [templateContent, outputContent] = await Promise.all([
          readFile(join(PROJECT_ROOT, "scaffold", templateRelativePath), "utf8"),
          readFile(join(tempDir, outputRelativePath), "utf8"),
        ]);

        expect(outputContent).toBe(templateContent);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("AC06: nvst init run a second time skips existing Impeccable files", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "nvst-init-impeccable-skip-"));
    try {
      const firstRun = await runCli(["init"], tempDir);
      expect(firstRun.exitCode).toBe(0);

      const secondRun = await runCli(["init"], tempDir);
      expect(secondRun.exitCode).toBe(0);
      expect(secondRun.stderr).toContain("Skipping existing file: .agents/skills/adapt/SKILL.md");
      expect(secondRun.stderr).toContain(
        "Skipping existing file: .agents/skills/frontend-design/reference/typography.md",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
