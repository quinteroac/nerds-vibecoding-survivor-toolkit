import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";

const PROJECT_ROOT = join(import.meta.dir, "..");
const RUNTIME_SKILL_PATH = join(
  PROJECT_ROOT,
  ".agents",
  "skills",
  "implement-user-story",
  "SKILL.md",
);
const SCAFFOLD_SKILL_PATH = join(
  PROJECT_ROOT,
  "scaffold",
  ".agents",
  "skills",
  "implement-user-story",
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
  ".agents/skills/frontend-design/tmpl_SKILL.md":
    "1281e529c4d7cfc058f3857c493976f1299c87a285f53ebe0cb2afbd4840a71f",
  ".agents/skills/harden/tmpl_SKILL.md":
    "4756b3f0365de089e7d4dd5a67f813df32a487a5cd2cf4793a32a58a04938a7b",
  ".agents/skills/polish/tmpl_SKILL.md":
    "20961487777bdb75f740c4ce6d7651968196ae80f424ce92bcfe4edfb010020b",
};

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

describe("implement-user-story SKILL.md UI references — US-002", () => {
  it("AC01: includes a UI / Frontend Stories section with Impeccable skills in required order", async () => {
    const content = await readFile(RUNTIME_SKILL_PATH, "utf8");

    expect(content).toContain("## UI / Frontend Stories");

    const frontendDesignIndex = content.indexOf("`frontend-design`");
    const hardenIndex = content.indexOf("`harden`");
    const polishIndex = content.indexOf("`polish`");

    expect(frontendDesignIndex).toBeGreaterThan(-1);
    expect(hardenIndex).toBeGreaterThan(-1);
    expect(polishIndex).toBeGreaterThan(-1);
    expect(frontendDesignIndex).toBeLessThan(hardenIndex);
    expect(hardenIndex).toBeLessThan(polishIndex);
  });

  it("AC02: defines UI-task detection heuristic with required keywords", async () => {
    const content = await readFile(RUNTIME_SKILL_PATH, "utf8");

    expect(content).toContain("detect whether this is a UI task");
    for (const keyword of UI_KEYWORDS) {
      expect(content).toContain(`\`${keyword}\``);
    }
  });

  it("AC03: provides clear, explicit instructions a junior can follow", async () => {
    const content = await readFile(RUNTIME_SKILL_PATH, "utf8");

    expect(content).toContain("Before implementation, detect whether this is a UI task.");
    expect(content).toContain("apply these Impeccable skills in this exact order");
    expect(content).toContain("1. `frontend-design` — set design direction and aesthetics.");
    expect(content).toContain("2. `harden` — handle UI edge cases and resilience.");
    expect(content).toContain("3. `polish` — run a final quality and refinement pass.");
  });

  it("AC04: keeps Impeccable skill files unchanged and only updates NVST references", async () => {
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
