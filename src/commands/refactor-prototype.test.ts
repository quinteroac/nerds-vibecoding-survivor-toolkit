import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { FLOW_REL_DIR } from "../state";
import type { State } from "../../scaffold/schemas/tmpl_state";
import { runRefactorPrototype } from "./refactor-prototype";

const REFACTOR_DISALLOW_MESSAGE =
  "Cannot refactor prototype: audit prototype must be run for this iteration first.";

function makeState(overrides: {
  currentPhase?: State["current_phase"];
  prototypeAuditStatus?: "pending" | "in_progress" | "completed" | "failed";
  prototypeAuditMissing?: boolean;
} = {}): State {
  const prototype = {
    prototype_creation: { status: "completed" as const, file: "it_000026_progress.json" as string | null },
    prototype_audit: overrides.prototypeAuditMissing
      ? undefined
      : {
          status: (overrides.prototypeAuditStatus ?? "completed") as "pending" | "in_progress" | "completed" | "failed",
          file: null as string | null,
        },
    prototype_refactor: { status: "pending" as const, file: null as string | null },
    prototype_approval: { status: "pending" as const, file: null as string | null },
  };
  return {
    current_iteration: "000026",
    current_phase: overrides.currentPhase ?? "prototype",
    phases: {
      define: {
        requirement_definition: { status: "approved" as const, file: null },
        prd_generation: { status: "completed" as const, file: "it_000026_PRD.json" },
      },
      prototype: prototype as State["phases"]["prototype"],
      refactor: {
        evaluation_report: { status: "pending" as const, file: null },
        refactor_plan: { status: "pending" as const, file: null },
        refactor_execution: { status: "pending" as const, file: null },
        changelog: { status: "pending" as const, file: null },
      },
    },
    last_updated: "2026-03-12T00:00:00.000Z",
    updated_by: "seed",
    history: [],
  };
}

describe("refactor prototype command", () => {
  test("registers refactor prototype command in CLI dispatch", async () => {
    const source = await readFile(join(process.cwd(), "src", "cli.ts"), "utf8");

    expect(source).toContain('import { runRefactorPrototype } from "./commands/refactor-prototype";');
    expect(source).toContain('if (command === "refactor") {');
    expect(source).toContain('if (subcommand === "prototype") {');
    expect(source).toContain("await runRefactorPrototype({ provider, force });");
  });

  test("US-002-AC01: throws when it_{iteration}_audit.json is missing from .agents/flow/", async () => {
    const expectedRel = join(FLOW_REL_DIR, "it_000026_audit.json");

    await expect(
      runRefactorPrototype(
        { provider: "ide" },
        {
          readStateFn: async () => makeState(),
          existsFn: async () => false,
        },
      ),
    ).rejects.toThrow(/Audit artifact not found/);

    await expect(
      runRefactorPrototype(
        { provider: "ide" },
        {
          readStateFn: async () => makeState(),
          existsFn: async () => false,
        },
      ),
    ).rejects.toThrow(expectedRel);
  });

  test("US-002-AC02: skill prompt receives iteration and path to it_{iteration}_audit.json via buildPrompt", async () => {
    const projectRoot = process.cwd();
    const prompts: string[] = [];

    await expect(
      runRefactorPrototype(
        { provider: "ide" },
        {
          readStateFn: async () => makeState(),
          existsFn: async () => true,
          loadSkillFn: async () => "# Refactor Skill",
          invokeAgentFn: async (options) => {
            prompts.push(options.prompt);
            return { exitCode: 0, stdout: "", stderr: "" };
          },
        },
      ),
    ).resolves.toBeUndefined();

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("# Refactor Skill");
    expect(prompts[0]).toContain("### iteration");
    expect(prompts[0]).toContain("000026");
    expect(prompts[0]).toContain("### audit_json_path");
    const expectedPath = join(projectRoot, FLOW_REL_DIR, "it_000026_audit.json");
    expect(prompts[0]).toContain(expectedPath);
  });

  test("US-002-AC03: SKILL.md instructs the agent to read the audit JSON, understand the refactor plan, and apply code changes", async () => {
    const skillPath = join(process.cwd(), ".agents", "skills", "refactor-prototype", "SKILL.md");
    const content = await readFile(skillPath, "utf8");
    expect(content).toMatch(/read.*audit|audit.*read/i);
    expect(content).toMatch(/refactor plan/i);
    expect(content).toMatch(/apply.*(code )?change|apply.*refactor/i);
  });

  test("US-002-AC04: invokes agent via invokeAgent with interactive: true", async () => {
    const invoked: { interactive?: boolean }[] = [];

    await expect(
      runRefactorPrototype(
        { provider: "codex" },
        {
          readStateFn: async () => makeState(),
          existsFn: async () => true,
          loadSkillFn: async () => "# Refactor Skill",
          invokeAgentFn: async (options) => {
            invoked.push({ interactive: options.interactive });
            return { exitCode: 0, stdout: "", stderr: "" };
          },
        },
      ),
    ).resolves.toBeUndefined();

    expect(invoked).toHaveLength(1);
    expect(invoked[0].interactive).toBe(true);
  });

  test("US-003-AC03: throws when agent invocation returns non-zero exit code", async () => {
    await expect(
      runRefactorPrototype(
        { provider: "ide" },
        {
          readStateFn: async () => makeState(),
          existsFn: async () => true,
          loadSkillFn: async () => "# Refactor Skill",
          invokeAgentFn: async () => ({ exitCode: 1, stdout: "", stderr: "Agent failed" }),
        },
      ),
    ).rejects.toThrow("Agent invocation failed with exit code 1");
  });

  test("builds and invokes full prompt for ide provider when audit file exists", async () => {
    const prompts: string[] = [];

    await expect(
      runRefactorPrototype(
        { provider: "ide" },
        {
          readStateFn: async () => makeState(),
          existsFn: async () => true,
          loadSkillFn: async () => "# Refactor Skill",
          invokeAgentFn: async (options) => {
            prompts.push(options.prompt);
            return { exitCode: 0, stdout: "", stderr: "" };
          },
        },
      ),
    ).resolves.toBeUndefined();

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("# Refactor Skill");
    expect(prompts[0]).toContain("### iteration");
    expect(prompts[0]).toContain("000026");
  });

  describe("US-003: Single agent performs the refactor", () => {
    test("US-003-AC01: SKILL.md instructs to read plan, apply all changes, run quality checks, and report completion", async () => {
      const skillPath = join(process.cwd(), ".agents", "skills", "refactor-prototype", "SKILL.md");
      const content = await readFile(skillPath, "utf8");

      expect(content).toMatch(/read.*audit json|audit json.*read/i);
      expect(content).toMatch(/refactor plan/i);
      expect(content).toMatch(/apply all recommended code changes|apply the refactor plan/i);
      expect(content).toMatch(/run the quality checks defined in the refactor plan|quality checks/i);
      expect(content).toMatch(/typecheck.*bun run typecheck/i);
      expect(content).toMatch(/test suite.*bun test/i);
    });

    test("US-003-AC02: SKILL.md instructs to perform full refactor autonomously in one session without mid-way questions", async () => {
      const skillPath = join(process.cwd(), ".agents", "skills", "refactor-prototype", "SKILL.md");
      const content = await readFile(skillPath, "utf8");

      expect(content).toMatch(/single.*autonomous agent session|single, autonomous agent session/i);
      expect(content).toMatch(/full refactor autonomously|perform the full refactor autonomously/i);
      expect(content).toMatch(/do not stop mid-way|do not stop midway|do not stop mid way/i);
      expect(content).toMatch(/do not.*ask the user|without asking the user/i);
    });
  });

  describe("US-004: Completion report artifact in .agents/flow/", () => {
    test("US-004-AC01: SKILL.md instructs writing it_{iteration}_refactor-report.md in .agents/flow/ with required contents", async () => {
      const skillPath = join(process.cwd(), ".agents", "skills", "refactor-prototype", "SKILL.md");
      const content = await readFile(skillPath, "utf8");

      expect(content).toMatch(/it_\{iteration\}_refactor-report\.md/i);
      expect(content).toMatch(/\.agents\/flow\//i);
      expect(content).toMatch(/summary of changes/i);
      expect(content).toMatch(/quality checks/i);
      expect(content).toMatch(/deviations from refactor plan/i);
      expect(content).toMatch(/None/);
    });

    test("US-004-AC02: SKILL.md defines mandatory sections Summary of changes, Quality checks, Deviations from refactor plan", async () => {
      const skillPath = join(process.cwd(), ".agents", "skills", "refactor-prototype", "SKILL.md");
      const content = await readFile(skillPath, "utf8");

      expect(content).toMatch(/## Summary of changes/i);
      expect(content).toMatch(/## Quality checks/i);
      expect(content).toMatch(/## Deviations from refactor plan/i);
    });
  });

  describe("US-001: State guard — command only runs after audit is complete", () => {
    describe("US-001-AC01: reads state and checks prototype_audit.status is not pending", () => {
      test("throws when prototype_audit.status is pending", async () => {
        await expect(
          runRefactorPrototype(
            { provider: "ide" },
            { readStateFn: async () => makeState({ prototypeAuditStatus: "pending" }) },
          ),
        ).rejects.toThrow(REFACTOR_DISALLOW_MESSAGE);
      });

      test("throws when prototype_audit is missing", async () => {
        await expect(
          runRefactorPrototype(
            { provider: "ide" },
            { readStateFn: async () => makeState({ prototypeAuditMissing: true }) },
          ),
        ).rejects.toThrow(REFACTOR_DISALLOW_MESSAGE);
      });

      test("throws when current_phase is not prototype", async () => {
        await expect(
          runRefactorPrototype(
            { provider: "ide" },
            { readStateFn: async () => makeState({ currentPhase: "define" }) },
          ),
        ).rejects.toThrow(REFACTOR_DISALLOW_MESSAGE);
      });

      test("proceeds when prototype_audit.status is completed", async () => {
        const invoked: unknown[] = [];
        await expect(
          runRefactorPrototype(
            { provider: "ide" },
            {
              readStateFn: async () => makeState({ prototypeAuditStatus: "completed" }),
              existsFn: async () => true,
              loadSkillFn: async () => "# Refactor Skill",
              invokeAgentFn: async (options) => {
                invoked.push(options);
                return { exitCode: 0, stdout: "", stderr: "" };
              },
            },
          ),
        ).resolves.toBeUndefined();
        expect(invoked).toHaveLength(1);
      });

      test("proceeds when prototype_audit.status is in_progress", async () => {
        const invoked: unknown[] = [];
        await expect(
          runRefactorPrototype(
            { provider: "ide" },
            {
              readStateFn: async () => makeState({ prototypeAuditStatus: "in_progress" }),
              existsFn: async () => true,
              loadSkillFn: async () => "# Refactor Skill",
              invokeAgentFn: async (options) => {
                invoked.push(options);
                return { exitCode: 0, stdout: "", stderr: "" };
              },
            },
          ),
        ).resolves.toBeUndefined();
        expect(invoked).toHaveLength(1);
      });

      test("proceeds when prototype_audit.status is failed", async () => {
        const invoked: unknown[] = [];
        await expect(
          runRefactorPrototype(
            { provider: "ide" },
            {
              readStateFn: async () => makeState({ prototypeAuditStatus: "failed" }),
              existsFn: async () => true,
              loadSkillFn: async () => "# Refactor Skill",
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

    describe("US-001-AC02: descriptive error and non-zero exit via process.exitCode", () => {
      test("throws with exact descriptive message when guard fails", async () => {
        await expect(
          runRefactorPrototype(
            { provider: "ide" },
            { readStateFn: async () => makeState({ prototypeAuditStatus: "pending" }) },
          ),
        ).rejects.toThrow(REFACTOR_DISALLOW_MESSAGE);
      });
    });

    describe("US-001-AC03: guard respects --force and flow_guardrail via assertGuardrail", () => {
      test("proceeds when --force and audit is pending (guardrail bypass)", async () => {
        const invoked: unknown[] = [];
        await expect(
          runRefactorPrototype(
            { provider: "ide", force: true },
            {
              readStateFn: async () => makeState({ prototypeAuditStatus: "pending" }),
              existsFn: async () => true,
              loadSkillFn: async () => "# Refactor Skill",
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
  });
});
