import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";

const PROJECT_ROOT = join(import.meta.dir, "..");
const RUNTIME_SKILL_PATH = join(
  PROJECT_ROOT,
  ".agents",
  "skills",
  "refactor-prototype",
  "SKILL.md",
);
const SCAFFOLD_SKILL_PATH = join(
  PROJECT_ROOT,
  "scaffold",
  ".agents",
  "skills",
  "refactor-prototype",
  "tmpl_SKILL.md",
);

const UI_KEYWORDS = [
  "UI",
  "interface",
  "page",
  "component",
  "visual",
  "button",
  "form",
  "layout",
  "style",
  "frontend",
] as const;

// Hashes from upstream pbakaus/impeccable commit 3c3ee6b4f244bf522ecadf2ae9dd0e688d195ed8.
const EXPECTED_IMPECCABLE_SHA256: Record<string, string> = {
  ".agents/skills/polish/tmpl_SKILL.md":
    "20961487777bdb75f740c4ce6d7651968196ae80f424ce92bcfe4edfb010020b",
  ".agents/skills/harden/tmpl_SKILL.md":
    "4756b3f0365de089e7d4dd5a67f813df32a487a5cd2cf4793a32a58a04938a7b",
  ".agents/skills/optimize/tmpl_SKILL.md":
    "34a1d0ea8ca6756e0f3f95ad0fb7870dba4c7fb341ea3a582d17268672783acc",
  ".agents/skills/normalize/tmpl_SKILL.md":
    "7a2e99550b52b0c6b859e086cab38b66db3823df26f52dfe829cc206b7f8eeca",
};

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

describe("refactor-prototype SKILL.md UI references — US-004", () => {
  it("AC01: includes UI / Frontend Refactor section with required Impeccable skills in order", async () => {
    const content = await readFile(RUNTIME_SKILL_PATH, "utf8");

    expect(content).toContain("## UI / Frontend Refactor");

    const polishIndex = content.indexOf("`polish`");
    const hardenIndex = content.indexOf("`harden`");
    const optimizeIndex = content.indexOf("`optimize`");
    const normalizeIndex = content.indexOf("`normalize`");

    expect(polishIndex).toBeGreaterThan(-1);
    expect(hardenIndex).toBeGreaterThan(-1);
    expect(optimizeIndex).toBeGreaterThan(-1);
    expect(normalizeIndex).toBeGreaterThan(-1);
    expect(polishIndex).toBeLessThan(hardenIndex);
    expect(hardenIndex).toBeLessThan(optimizeIndex);
    expect(optimizeIndex).toBeLessThan(normalizeIndex);

    expect(content).toContain("alignment, spacing, and consistency");
    expect(content).toContain("edge cases, error states, and i18n");
    expect(content).toContain("performance improvements");
    expect(content).toContain("design system consistency");
  });

  it("AC02: defines the same UI-task detection heuristic used in US-002", async () => {
    const content = await readFile(RUNTIME_SKILL_PATH, "utf8");

    expect(content).toContain("detect whether any item is a UI task");
    expect(content).toContain(
      "refactor item text, related user story description, or acceptance criteria",
    );
    for (const keyword of UI_KEYWORDS) {
      expect(content).toContain(`\`${keyword}\``);
    }
  });

  it("AC03: keeps Impeccable skill files unchanged and only updates refactor-prototype references", async () => {
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
