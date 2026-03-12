import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseOpenQuestionsFromPrd } from "./prd-open-questions";

describe("parseOpenQuestionsFromPrd", () => {
  test("AC01: returns empty array when PRD has no Open Questions section", () => {
    const prd = "# Requirement: X\n\n## Goals\n- Goal 1.\n";
    expect(parseOpenQuestionsFromPrd(prd)).toEqual([]);
  });

  test("AC01: returns empty array when Open Questions section exists but has no list items", () => {
    const prd = "# Requirement: X\n\n## Open Questions\n\n(Resolved later.)\n";
    expect(parseOpenQuestionsFromPrd(prd)).toEqual([]);
  });

  test("AC01: detects one open question (bullet)", () => {
    const prd = "## Open Questions\n- What is the deadline?\n";
    expect(parseOpenQuestionsFromPrd(prd)).toEqual(["What is the deadline?"]);
  });

  test("AC01: detects multiple open questions (bullets)", () => {
    const prd = [
      "## Open Questions",
      "- What is the deadline?",
      "- Who approves the design?",
      "- Any compliance constraints?",
    ].join("\n");
    expect(parseOpenQuestionsFromPrd(prd)).toEqual([
      "What is the deadline?",
      "Who approves the design?",
      "Any compliance constraints?",
    ]);
  });

  test("AC01: detects open questions with asterisk list style", () => {
    const prd = "## Open Questions\n* First question?\n* Second question?\n";
    expect(parseOpenQuestionsFromPrd(prd)).toEqual(["First question?", "Second question?"]);
  });

  test("AC01: detects open questions with numbered list", () => {
    const prd = "## Open Questions\n1. Question one?\n2. Question two?\n";
    expect(parseOpenQuestionsFromPrd(prd)).toEqual(["Question one?", "Question two?"]);
  });

  test("AC01: section is case-insensitive for heading", () => {
    const prd = "## open questions\n- Only one?\n";
    expect(parseOpenQuestionsFromPrd(prd)).toEqual(["Only one?"]);
  });

  test("AC01: stops at next ## heading", () => {
    const prd = [
      "## Open Questions",
      "- Q1?",
      "- Q2?",
      "## Appendix",
      "- Not a question.",
    ].join("\n");
    expect(parseOpenQuestionsFromPrd(prd)).toEqual(["Q1?", "Q2?"]);
  });

  test("AC01: ignores empty list items", () => {
    const prd = "## Open Questions\n- \n- Real question?\n";
    expect(parseOpenQuestionsFromPrd(prd)).toEqual(["Real question?"]);
  });

  test("AC01: trims whitespace in question text", () => {
    const prd = "## Open Questions\n-  What is the scope?  \n";
    expect(parseOpenQuestionsFromPrd(prd)).toEqual(["What is the scope?"]);
  });
});

describe("create-pr-document skill open-questions instructions", () => {
  test("AC02/AC03: skill instructs agent to ask open questions one by one and wait for answer", async () => {
    const skillPath = join(process.cwd(), ".agents", "skills", "create-pr-document", "SKILL.md");
    const content = await readFile(skillPath, "utf8").catch(() => "");
    if (!content) return;
    expect(content).toContain("Resolve open questions");
    expect(content).toContain("one by one");
    expect(content).toContain("Wait for the user's answer");
  });

  test("US-002-AC01: skill instructs agent to include suggestions or options when asking open questions", async () => {
    const skillPath = join(process.cwd(), ".agents", "skills", "create-pr-document", "SKILL.md");
    const content = await readFile(skillPath, "utf8").catch(() => "");
    if (!content) return;
    expect(content).toContain("suggestions or inferred options");
    expect(content).toMatch(/lettered choices|options.*Other/i);
  });
});
