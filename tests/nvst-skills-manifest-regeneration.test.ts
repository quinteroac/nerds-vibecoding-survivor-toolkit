import { describe, it, expect } from "bun:test";
import { NVST_SKILLS_FILES } from "../src/nvst-skills-manifest";

const relativePaths = NVST_SKILLS_FILES.map((f) => f.relativePath);

describe("US-004: Regenerate nvst-skills-manifest.ts", () => {
  it("US-004-AC02: manifest does not reference old skill directory names", () => {
    const oldNames = ["create-pr-document/", "refine-pr-document/", "implement-user-story/", "automated-fix/"];
    for (const oldName of oldNames) {
      const match = relativePaths.find((p) => p.startsWith(oldName));
      expect(match).toBeUndefined();
    }
  });

  it("US-004-AC03: manifest includes new skill directory names", () => {
    const newNames = [
      "define-requirement/SKILL.md",
      "refine-requirement/SKILL.md",
      "create-prototype/SKILL.md",
      "execute-automated-fix/SKILL.md",
    ];
    for (const expected of newNames) {
      expect(relativePaths).toContain(expected);
    }
  });
});
