/**
 * Tests for US-002: Agent reads lessons learned before starting a user story
 * Iteration: 000043
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { defaultReadLessonsLearned } from "../src/commands/create-prototype";

const PROJECT_ROOT = process.cwd();
const SKILL_PATH = join(PROJECT_ROOT, "nvst-skills", "create-prototype", "SKILL.md");

// ---------------------------------------------------------------------------
// AC01 / AC03: defaultReadLessonsLearned helper
// ---------------------------------------------------------------------------

describe("US-002-AC01 & AC03: defaultReadLessonsLearned", () => {
  it("AC01: returns file content when lessons-learned file exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nvst-test-"));
    try {
      const filePath = join(dir, "it_000043_lessons-learned.md");
      const content = "# Lessons Learned\n\n## US-001 — Some story\n\n**Summary:** It worked.";
      await writeFile(filePath, content, "utf8");

      const result = await defaultReadLessonsLearned(filePath);
      expect(result).toBe(content);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("AC03: returns empty string when file does not exist (no error)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nvst-test-"));
    try {
      const filePath = join(dir, "it_000043_lessons-learned.md");
      const result = await defaultReadLessonsLearned(filePath);
      expect(result).toBe("");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("AC03: resolves without throwing for non-existent file", async () => {
    const nonExistentPath = join(tmpdir(), "does-not-exist-nvst-test-123", "lessons.md");
    await expect(defaultReadLessonsLearned(nonExistentPath)).resolves.toBe("");
  });
});

// ---------------------------------------------------------------------------
// AC01: lessons_learned key is passed to buildPrompt — source code check
// ---------------------------------------------------------------------------

describe("US-002-AC01: create-prototype.ts includes lessons_learned in buildPrompt calls", () => {
  it("source code passes lessons_learned context variable to buildPrompt", async () => {
    const srcPath = join(PROJECT_ROOT, "src", "commands", "create-prototype.ts");
    const src = await readFile(srcPath, "utf-8");

    // Both IDE and non-IDE mode buildPrompt calls must include lessons_learned
    const matches = src.match(/lessons_learned:\s*lessonsLearnedContent/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("reads lessons-learned file from the correct iteration path pattern", async () => {
    const srcPath = join(PROJECT_ROOT, "src", "commands", "create-prototype.ts");
    const src = await readFile(srcPath, "utf-8");
    expect(src).toContain("it_${iteration}_lessons-learned_");
    expect(src).toContain("readLessonsLearnedFn");
  });

  it("uses FLOW_REL_DIR when constructing the lessons-learned path", async () => {
    const srcPath = join(PROJECT_ROOT, "src", "commands", "create-prototype.ts");
    const src = await readFile(srcPath, "utf-8");
    // The path should use FLOW_REL_DIR (same as other flow artifacts)
    expect(src).toContain("FLOW_REL_DIR");
    // lessons-learned file and FLOW_REL_DIR join should both appear in source
    expect(src).toContain("lessonsLearnedFile");
    expect(src).toContain("join(projectRoot, FLOW_REL_DIR, lessonsLearnedFile)");
  });
});

// ---------------------------------------------------------------------------
// AC02 & AC04: SKILL.md content
// ---------------------------------------------------------------------------

describe("US-002-AC02: SKILL.md instructs agent to review lessons_learned", () => {
  it("AC02: SKILL.md mentions lessons_learned context variable", async () => {
    const content = await readFile(SKILL_PATH, "utf-8");
    expect(content).toContain("lessons_learned");
  });

  it("AC02: SKILL.md includes a step to review lessons learned before planning", async () => {
    const content = await readFile(SKILL_PATH, "utf-8");
    expect(content).toMatch(/[Rr]eview.*lessons.*learned|lessons.*learned.*review/i);
  });

  it("AC02: SKILL.md instructs to skip gracefully when lessons_learned is absent or empty", async () => {
    const content = await readFile(SKILL_PATH, "utf-8");
    expect(content).toMatch(/[Ss]kip.*silently|absent or empty/);
  });

  it("AC04: SKILL.md references clearly labelled section for lessons learned content", async () => {
    const content = await readFile(SKILL_PATH, "utf-8");
    // The lessons_learned context variable is the clear label for the section
    expect(content).toContain("lessons_learned");
    // Step 3 should mention reviewing lessons learned
    expect(content).toContain("Review lessons learned");
  });
});

describe("US-002-AC04: lessons learned content is clearly labelled in the prompt", () => {
  it("AC04: source code prepends human-readable heading to lessons_learned content", async () => {
    const srcPath = join(PROJECT_ROOT, "src", "commands", "create-prototype.ts");
    const src = await readFile(srcPath, "utf-8");
    expect(src).toContain("## Lessons Learned from Previous Stories");
  });

  it("AC04: empty lessons_learned produces no heading (no noise)", async () => {
    const srcPath = join(PROJECT_ROOT, "src", "commands", "create-prototype.ts");
    const src = await readFile(srcPath, "utf-8");
    // The heading is only prepended when lessonsLearnedRaw is non-empty (truthy)
    expect(src).toMatch(/lessonsLearnedRaw\s*\n?\s*\?/);
  });
});

describe("US-002-AC03: empty lessons_learned is handled gracefully", () => {
  it("readLessonsLearnedFn is injected into CreatePrototypeDeps interface", async () => {
    const srcPath = join(PROJECT_ROOT, "src", "commands", "create-prototype.ts");
    const src = await readFile(srcPath, "utf-8");
    expect(src).toContain("readLessonsLearnedFn: (path: string) => Promise<string>");
  });

  it("defaultReadLessonsLearned is exported from create-prototype.ts", async () => {
    const { defaultReadLessonsLearned: fn } = await import(
      "../src/commands/create-prototype"
    );
    expect(typeof fn).toBe("function");
  });
});
