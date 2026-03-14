import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const SKILL_PATH = join(PROJECT_ROOT, ".agents", "skills", "ideate", "SKILL.md");

async function readSkill(): Promise<string> {
  return readFile(SKILL_PATH, "utf8");
}

function parseFrontmatter(content: string): Record<string, string> {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) return {};
  const endIndex = trimmed.indexOf("---", 3);
  if (endIndex === -1) return {};
  const block = trimmed.slice(3, endIndex).trim();
  const result: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^"|"$/g, "");
    result[key] = value;
  }
  return result;
}

describe("ideate SKILL.md — US-002", () => {
  // AC01: file exists with valid YAML front matter (name, description, user-invocable)
  it("AC01: has valid YAML front matter with name, description, and user-invocable", async () => {
    const content = await readSkill();
    expect(content.length).toBeGreaterThan(0);

    const fm = parseFrontmatter(content);
    expect(fm["name"]).toBeTruthy();
    expect(fm["description"]).toBeTruthy();
    expect(fm["user-invocable"]).toBeTruthy();
  });

  // AC02: instructs agent to read ROADMAP.md and PROJECT_CONTEXT.md before the interview
  it("AC02: instructs agent to read ROADMAP.md and PROJECT_CONTEXT.md before interview", async () => {
    const content = await readSkill();
    expect(content).toContain("ROADMAP.md");
    expect(content).toContain("PROJECT_CONTEXT.md");

    // Both files should be mentioned before the interview questions
    const roadmapIndex = content.indexOf("ROADMAP.md");
    const projectContextIndex = content.indexOf("PROJECT_CONTEXT.md");
    const firstQuestionIndex = content.search(/Q1\./);

    expect(roadmapIndex).toBeLessThan(firstQuestionIndex);
    expect(projectContextIndex).toBeLessThan(firstQuestionIndex);
  });

  // AC03: one-question-at-a-time interview with at minimum 5 steps
  it("AC03: has a one-question-at-a-time interview with at least 5 questions", async () => {
    const content = await readSkill();

    // Verify one-at-a-time instruction is present
    expect(content.toLowerCase()).toMatch(/one.question.at.a.time|one at a time/);

    // Verify at least 5 interview questions
    const q1 = content.includes("Q1.");
    const q2 = content.includes("Q2.");
    const q3 = content.includes("Q3.");
    const q4 = content.includes("Q4.");
    const q5 = content.includes("Q5.");
    expect(q1).toBe(true);
    expect(q2).toBe(true);
    expect(q3).toBe(true);
    expect(q4).toBe(true);
    expect(q5).toBe(true);
  });

  // AC04: proposes 2-4 ideas with rationale, effort estimate (S/M/L), and differentiation
  it("AC04: instructs agent to propose 2-4 ideas with rationale, effort (S/M/L), and differentiation", async () => {
    const content = await readSkill();

    expect(content).toMatch(/2.{1,5}4.*idea|propose.*2.{1,5}4/i);
    expect(content).toContain("Rationale");
    expect(content).toMatch(/Effort.*S\/M\/L|S\/M\/L.*Effort/);
    expect(content).toContain("Differentiation");
  });

  // AC05: instructs agent to write or update ROADMAP.md with proposed items as new candidates
  it("AC05: instructs agent to write or update ROADMAP.md with proposed items as candidates", async () => {
    const content = await readSkill();

    // Should mention updating ROADMAP.md
    const roadmapWritePattern = /update.*ROADMAP\.md|write.*ROADMAP\.md|ROADMAP\.md.*update|ROADMAP\.md.*write/i;
    expect(content).toMatch(roadmapWritePattern);

    // Should mention candidates
    expect(content).toContain("candidate");
  });

  // AC06: optionally instructs agent to flag if PROJECT_CONTEXT.md needs updating
  it("AC06: instructs agent to optionally flag if PROJECT_CONTEXT.md needs updating", async () => {
    const content = await readSkill();

    // Should mention flagging or checking if PROJECT_CONTEXT.md needs updating
    const flagPattern =
      /flag.*PROJECT_CONTEXT|PROJECT_CONTEXT.*flag|PROJECT_CONTEXT.*update|update.*PROJECT_CONTEXT/i;
    expect(content).toMatch(flagPattern);
  });

  // AC07: loadSkill("ideate") succeeds — file exists at the correct path
  it("AC07: ideate SKILL.md exists at the correct path for loadSkill", async () => {
    const content = await readSkill();
    expect(content.length).toBeGreaterThan(0);
  });
});
