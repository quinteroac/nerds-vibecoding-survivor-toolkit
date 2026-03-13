import { describe, expect, test } from "bun:test";
import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = process.cwd();

const EXPECTED_SKILLS = [
  "approve-prototype",
  "audit-prototype",
  "create-pr-document",
  "implement-user-story",
  "refactor-prototype",
  "refine-pr-document",
] as const;

const REMOVED_SCHEMA_ARTIFACTS = [
  "schemas/refactor-execution-progress.ts",
  "schemas/refactor-prd.ts",
  "schemas/test-execution-progress.ts",
  "schemas/test-plan.test.ts",
] as const;

const ACTIVE_COMMAND_FILES = [
  "src/commands/approve-requirement.ts",
  "src/commands/approve-prototype.ts",
  "src/commands/audit-prototype.ts",
  "src/commands/create-prototype.ts",
  "src/commands/define-requirement.ts",
  "src/commands/refactor-prototype.ts",
  "src/commands/refine-requirement.ts",
  "src/commands/write-json.ts",
] as const;

describe("US-004: Skills and schemas align to the new loop", () => {
  test("US-004-AC01: runtime and scaffold skills contain no dead entries", async () => {
    const runtimeSkills = (await readdir(join(PROJECT_ROOT, ".agents", "skills"))).sort();
    const scaffoldSkills = (await readdir(join(PROJECT_ROOT, "scaffold", ".agents", "skills"))).sort();

    expect(runtimeSkills).toEqual([...EXPECTED_SKILLS]);
    expect(scaffoldSkills).toEqual([...EXPECTED_SKILLS]);
  });

  test("US-004-AC02: loop skills are present and artifact-aware", async () => {
    const allSkills = [
      ".agents/skills/audit-prototype/SKILL.md",
      ".agents/skills/refactor-prototype/SKILL.md",
      ".agents/skills/approve-prototype/SKILL.md",
      "scaffold/.agents/skills/audit-prototype/tmpl_SKILL.md",
      "scaffold/.agents/skills/refactor-prototype/tmpl_SKILL.md",
      "scaffold/.agents/skills/approve-prototype/tmpl_SKILL.md",
    ];

    for (const relativePath of allSkills) {
      const content = await readFile(join(PROJECT_ROOT, relativePath), "utf8");
      expect(content).toContain(".agents/flow/it_{iteration}_PRD.json");
      expect(content).toContain(".agents/flow/it_{iteration}_progress.json");
    }

    // Refactor and approve-prototype skills are now fully implemented,
    // so there should be no remaining "stub" wording in the loop skills.
    const noStubSkills = [
      ".agents/skills/refactor-prototype/SKILL.md",
      ".agents/skills/approve-prototype/SKILL.md",
      "scaffold/.agents/skills/refactor-prototype/tmpl_SKILL.md",
      "scaffold/.agents/skills/approve-prototype/tmpl_SKILL.md",
    ];

    for (const relativePath of noStubSkills) {
      const content = await readFile(join(PROJECT_ROOT, relativePath), "utf8");
      expect(content).not.toContain("currently a stub command");
    }
  });

  test("US-004-AC03: write-json schemas support only current loop/core artifacts", async () => {
    const source = await readFile(join(PROJECT_ROOT, "src", "commands", "write-json.ts"), "utf8");

    expect(source).toContain('"prototype-progress": PrototypeProgressSchema');
    expect(source).toContain("state: StateSchema");
    expect(source).toContain("prd: PrdSchema");
    expect(source).toContain("issues: IssuesSchema");
    expect(source).toContain("audit: AuditSchema");

    expect(source).not.toContain("RefactorPrdSchema");
    expect(source).not.toContain("RefactorExecutionProgressSchema");
    expect(source).not.toContain("TestPlanSchema");
    expect(source).not.toContain("progress: ProgressSchema");
    expect(source).not.toContain('"refactor-prd"');
    expect(source).not.toContain('"refactor-execution-progress"');
    expect(source).not.toContain('"test-plan"');

    for (const relativePath of REMOVED_SCHEMA_ARTIFACTS) {
      await expect(access(join(PROJECT_ROOT, relativePath), constants.F_OK)).rejects.toBeDefined();
    }
  });

  test("US-004-AC04: active command surface has no removed-flow schema imports", async () => {
    for (const relativePath of ACTIVE_COMMAND_FILES) {
      const source = await readFile(join(PROJECT_ROOT, relativePath), "utf8");
      expect(source).not.toContain("tmpl_refactor-prd");
      expect(source).not.toContain("tmpl_refactor-execution-progress");
      expect(source).not.toContain("tmpl_test-plan");
      expect(source).not.toContain("tmpl_test-execution-progress");
    }
  });
});
