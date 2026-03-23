import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const DEFINE_REQ_SKILL = join(PROJECT_ROOT, "nvst-skills", "define-requirement", "SKILL.md");
const CREATE_CTX_SKILL = join(PROJECT_ROOT, "nvst-skills", "create-project-context", "SKILL.md");

describe("US-002: Skills that write to state.json skip that step when running standalone", () => {
  // AC01: define-requirement final state step is conditional on state.json existing
  it("AC01: define-requirement skips state update if state.json absent", async () => {
    const content = await readFile(DEFINE_REQ_SKILL, "utf8");
    expect(content).toMatch(/If `.agents\/state\.json` exists.*update/s);
    expect(content).toMatch(/does not exist.*standalone mode.*skip/s);
  });

  // AC01: create-project-context final state step is conditional on state.json existing
  it("AC01: create-project-context skips state update if state.json absent", async () => {
    const content = await readFile(CREATE_CTX_SKILL, "utf8");
    expect(content).toMatch(/If `.agents\/state\.json` exists.*update/s);
    expect(content).toMatch(/does not exist.*standalone mode.*skip/s);
  });

  // AC02: notification message is clear and non-blocking in define-requirement
  it("AC02: define-requirement has the correct standalone notification message", async () => {
    const content = await readFile(DEFINE_REQ_SKILL, "utf8");
    expect(content).toContain("Running standalone — state.json not found, skipping state update.");
  });

  // AC02: notification message is clear and non-blocking in create-project-context
  it("AC02: create-project-context has the correct standalone notification message", async () => {
    const content = await readFile(CREATE_CTX_SKILL, "utf8");
    expect(content).toContain("Running standalone — state.json not found, skipping state update.");
  });

  // AC01: define-requirement checklist reflects the conditional state update
  it("AC01: define-requirement checklist references conditional state update", async () => {
    const content = await readFile(DEFINE_REQ_SKILL, "utf8");
    expect(content).toMatch(/If `.agents\/state\.json` exists.*requirement_definition/s);
  });

  // AC01: create-project-context checklist reflects the conditional state update
  it("AC01: create-project-context checklist references conditional state update", async () => {
    const content = await readFile(CREATE_CTX_SKILL, "utf8");
    expect(content).toMatch(/If `.agents\/state\.json` exists.*project_context/s);
  });
});
