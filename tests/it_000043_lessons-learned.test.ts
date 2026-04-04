import { describe, it, expect, beforeAll } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const SKILL_PATH = join(import.meta.dir, "..", "nvst-skills", "create-prototype", "SKILL.md");

let skillContent: string;

beforeAll(async () => {
  skillContent = await readFile(SKILL_PATH, "utf-8");
});

describe("US-001: Lessons-learned instruction in create-prototype SKILL.md", () => {
  // AC01: instructs agent to write lessons-learned to .agents/flow/it_{iteration}_lessons-learned.md
  it("AC01: instructs the agent to create or append a lessons-learned entry", () => {
    expect(skillContent).toContain("lessons-learned");
    expect(skillContent).toContain(".agents/flow/");
    expect(skillContent).toContain("create or append");
  });

  // AC02: entry includes user story ID, summary, key decisions, pitfalls, useful context
  it("AC02: entry template includes all required fields", () => {
    expect(skillContent).toContain("User Story ID");
    expect(skillContent).toContain("Summary");
    expect(skillContent).toContain("Key Decisions");
    expect(skillContent).toContain("Pitfalls Encountered");
    expect(skillContent).toContain("Useful Context for Future Agents");
  });

  // AC03: instruction is placed at the end, after all implementation steps (checklist)
  it("AC03: lessons-learned instruction appears after the checklist section", () => {
    const checklistIndex = skillContent.indexOf("## Checklist");
    const lessonsIndex = skillContent.indexOf("## Lessons Learned");
    expect(checklistIndex).toBeGreaterThan(-1);
    expect(lessonsIndex).toBeGreaterThan(-1);
    expect(lessonsIndex).toBeGreaterThan(checklistIndex);
  });

  it("AC03: checklist contains a lessons-learned item", () => {
    expect(skillContent).toContain("Lessons-learned entry written to");
  });

  // AC04: uses lessons_learned_file context variable for per-PRD naming
  it("AC04: references the correct file naming convention", () => {
    expect(skillContent).toContain("{lessons_learned_file}");
    expect(skillContent).toContain("lessons_learned_file");
  });
});
