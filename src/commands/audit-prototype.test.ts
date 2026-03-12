import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { State } from "../../scaffold/schemas/tmpl_state";
import { runAuditPrototype } from "./audit-prototype";

function makeState(overrides: {
  currentPhase?: State["current_phase"];
  prototypeCreationStatus?: "pending" | "in_progress" | "completed";
} = {}): State {
  return {
    current_iteration: "000025",
    current_phase: overrides.currentPhase ?? "prototype",
    phases: {
      define: {
        requirement_definition: { status: "approved", file: null },
        prd_generation: { status: "completed", file: "it_000025_PRD.json" },
      },
      prototype: {
        prototype_creation: {
          status: overrides.prototypeCreationStatus ?? "completed",
          file: "it_000025_progress.json",
        },
        prototype_audit: { status: "pending", file: null },
        prototype_refactor: { status: "pending", file: null },
        prototype_approval: { status: "pending", file: null },
      },
      refactor: {
        evaluation_report: { status: "pending", file: null },
        refactor_plan: { status: "pending", file: null },
        refactor_execution: { status: "pending", file: null },
        changelog: { status: "pending", file: null },
      },
    },
    last_updated: "2026-03-12T00:00:00.000Z",
    updated_by: "seed",
    history: [],
  };
}

describe("audit prototype command", () => {
  test("registers audit prototype command in CLI dispatch", async () => {
    const source = await readFile(join(process.cwd(), "src", "cli.ts"), "utf8");

    expect(source).toContain('import { runAuditPrototype } from "./commands/audit-prototype";');
    expect(source).toContain('if (command === "audit") {');
    expect(source).toContain('if (subcommand === "prototype") {');
    expect(source).toContain("await runAuditPrototype({ provider, force });");
  });

  describe("US-001-AC01: fails or refuses when state does not allow audit", () => {
    const disallowMessage =
      "Cannot audit prototype: create prototype must be run for this iteration first (current phase/state does not allow audit).";

    test("throws when current_phase is define", async () => {
      await expect(
        runAuditPrototype(
          { provider: "ide" },
          {
            readStateFn: async () => makeState({ currentPhase: "define" }),
          },
        ),
      ).rejects.toThrow(disallowMessage);
    });

    test("throws when current_phase is prototype but prototype_creation is pending", async () => {
      await expect(
        runAuditPrototype(
          { provider: "ide" },
          {
            readStateFn: async () => makeState({ prototypeCreationStatus: "pending" }),
          },
        ),
      ).rejects.toThrow(disallowMessage);
    });

    test("throws when prototype_creation is missing", async () => {
      const stateWithoutCreation = makeState();
      stateWithoutCreation.phases.prototype.prototype_creation = undefined;

      await expect(
        runAuditPrototype(
          { provider: "ide" },
          {
            readStateFn: async () => stateWithoutCreation,
          },
        ),
      ).rejects.toThrow(disallowMessage);
    });

    test("proceeds when phase is prototype and prototype_creation is in_progress", async () => {
      const invoked: unknown[] = [];
      await expect(
        runAuditPrototype(
          { provider: "ide" },
          {
            readStateFn: async () => makeState({ prototypeCreationStatus: "in_progress" }),
            loadSkillFn: async () => "# Audit Skill",
            invokeAgentFn: async (options) => {
              invoked.push(options);
              return { exitCode: 0, stdout: "", stderr: "" };
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(invoked).toHaveLength(1);
    });

    test("proceeds when --force and state disallows (guardrail bypass)", async () => {
      const invoked: unknown[] = [];
      await expect(
        runAuditPrototype(
          { provider: "ide", force: true },
          {
            readStateFn: async () => makeState({ currentPhase: "define" }),
            loadSkillFn: async () => "# Audit Skill",
            invokeAgentFn: async (options) => {
              invoked.push(options);
              return { exitCode: 0, stdout: "", stderr: "" };
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(invoked).toHaveLength(1);
    });
  });

  describe("US-001-AC02: when allowed, invokes audit skill", () => {
    test("loads audit-prototype skill and invokes agent with prompt containing iteration", async () => {
      const prompts: string[] = [];

      await expect(
        runAuditPrototype(
          { provider: "ide" },
          {
            readStateFn: async () => makeState(),
            loadSkillFn: async () => "# Audit Prototype\nValidate PRD vs code.",
            invokeAgentFn: async (options) => {
              prompts.push(options.prompt);
              return { exitCode: 0, stdout: "", stderr: "" };
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("# Audit Prototype");
      expect(prompts[0]).toContain("Validate PRD vs code.");
      expect(prompts[0]).toContain("000025");
      expect(prompts[0]).toContain("### iteration");
    });

    test("throws when agent invocation returns non-zero exit code", async () => {
      await expect(
        runAuditPrototype(
          { provider: "ide" },
          {
            readStateFn: async () => makeState(),
            loadSkillFn: async () => "# Skill",
            invokeAgentFn: async () => ({ exitCode: 1, stdout: "", stderr: "Agent failed" }),
          },
        ),
      ).rejects.toThrow("Agent invocation failed with exit code 1");
    });
  });

  describe("US-001-AC03: skill-based pattern", () => {
    test("loads skill from audit-prototype (skill name)", async () => {
      const skillNames: string[] = [];

      await runAuditPrototype(
        { provider: "ide" },
        {
          readStateFn: async () => makeState(),
          loadSkillFn: async (_root, skillName) => {
            skillNames.push(skillName);
            return "# Skill";
          },
          invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        },
      );

      expect(skillNames).toEqual(["audit-prototype"]);
    });
  });

  describe("US-003: Choose how to act on recommendations", () => {
    test("US-003-AC01: skill instructs to ask user to choose (a) follow, (b) change, (c) leave as is after report", async () => {
      const skillPath = join(process.cwd(), ".agents", "skills", "audit-prototype", "SKILL.md");
      const content = await readFile(skillPath, "utf8");

      expect(content).toContain("(a)");
      expect(content).toContain("(b)");
      expect(content).toContain("(c)");
      expect(content).toContain("follow recommendations");
      expect(content).toContain("change recommendations");
      expect(content).toContain("leave as is");
      expect(content).toMatch(/presenting the compliance report|After presenting the report/i);
    });

    test("US-003-AC02: skill instructs to ask what to change and update recommendations when user chooses (b)", async () => {
      const skillPath = join(process.cwd(), ".agents", "skills", "audit-prototype", "SKILL.md");
      const content = await readFile(skillPath, "utf8");

      expect(content).toContain("(b)");
      expect(content).toMatch(/ask.*what.*change|what they want to change/i);
      expect(content).toMatch(/update the recommendations|update recommendations accordingly/i);
    });

    test("US-003-AC03: skill instructs that chosen outcome drives generation of it_{iteration}_audit.md and when applicable audit.json and TECHNICAL_DEBT.md", async () => {
      const skillPath = join(process.cwd(), ".agents", "skills", "audit-prototype", "SKILL.md");
      const content = await readFile(skillPath, "utf8");

      expect(content).toMatch(/it_\{iteration\}_audit\.md|it_.*_audit\.md/);
      expect(content).toMatch(/it_\{iteration\}_audit\.json|it_.*_audit\.json/);
      expect(content).toContain("TECHNICAL_DEBT.md");
      expect(content).toMatch(/chosen outcome|outcome to drive|Outcome-driven/);
    });
  });
});
