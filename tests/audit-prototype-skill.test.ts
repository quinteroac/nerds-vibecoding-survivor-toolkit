import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";

const PROJECT_ROOT = join(import.meta.dir, "..");
const RUNTIME_SKILL_PATH = join(PROJECT_ROOT, ".agents", "skills", "audit-prototype", "SKILL.md");
const SCAFFOLD_SKILL_PATH = join(
  PROJECT_ROOT,
  "scaffold",
  ".agents",
  "skills",
  "audit-prototype",
  "tmpl_SKILL.md",
);

// Hashes from upstream pbakaus/impeccable commit 3c3ee6b4f244bf522ecadf2ae9dd0e688d195ed8.
const EXPECTED_IMPECCABLE_SHA256: Record<string, string> = {
  ".agents/skills/audit/tmpl_SKILL.md": "7caba2be9e2ce1bc11fb8635406a7e67ee8a296a52ee59848e02c2ef60531a0c",
  ".agents/skills/critique/tmpl_SKILL.md":
    "f615589febd39710901817be9d8673c6ed2d8a3123ebdf2e6e87785a1390b52d",
  ".agents/skills/optimize/tmpl_SKILL.md":
    "34a1d0ea8ca6756e0f3f95ad0fb7870dba4c7fb341ea3a582d17268672783acc",
};

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

describe("audit-prototype SKILL.md UI references — US-003", () => {
  it("AC01: includes UI / Frontend Audit section with required Impeccable skills and focus areas", async () => {
    const content = await readFile(RUNTIME_SKILL_PATH, "utf8");

    expect(content).toContain("## UI / Frontend Audit");
    expect(content).toContain("`audit`");
    expect(content).toContain("`critique`");
    expect(content).toContain("`optimize`");
    expect(content).toContain("accessibility");
    expect(content).toContain("interface performance");
    expect(content).toContain("theming");
    expect(content).toContain("responsive");
    expect(content).toContain("UX design evaluation");
  });

  it("AC02: directs UI findings into Minor observations or FR/US assessment notes", async () => {
    const content = await readFile(RUNTIME_SKILL_PATH, "utf8");

    expect(content).toContain("Minor observations");
    expect(content).toContain("FR/US assessment notes");
    expect(content).toContain("Verification by FR");
    expect(content).toContain("Verification by US");
  });

  it("AC03: places UI / Frontend Audit guidance before the Diagnostic Scan section", async () => {
    const content = await readFile(RUNTIME_SKILL_PATH, "utf8");

    const uiSectionIndex = content.indexOf("## UI / Frontend Audit");
    const diagnosticScanIndex = content.indexOf("## Diagnostic Scan");

    expect(uiSectionIndex).toBeGreaterThan(-1);
    expect(diagnosticScanIndex).toBeGreaterThan(-1);
    expect(uiSectionIndex).toBeLessThan(diagnosticScanIndex);
  });

  it("AC04: keeps Impeccable skill files unchanged and only updates audit-prototype references", async () => {
    for (const [relativePath, expectedHash] of Object.entries(EXPECTED_IMPECCABLE_SHA256)) {
      const absolutePath = join(PROJECT_ROOT, "scaffold", relativePath);
      const content = await readFile(absolutePath, "utf8");
      expect(sha256(content)).toBe(expectedHash);
    }

    const [runtimeSkill, scaffoldSkill] = await Promise.all([
      readFile(RUNTIME_SKILL_PATH, "utf8"),
      readFile(SCAFFOLD_SKILL_PATH, "utf8"),
    ]);

    expect(runtimeSkill).toBe(scaffoldSkill);
  });
});
