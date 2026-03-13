import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

  test("prints not implemented placeholder message without throwing", async () => {
    const logs: string[] = [];

    await expect(
      runRefactorPrototype(
        { provider: "gemini" },
        {
          logFn: (message) => {
            logs.push(message);
          },
          readStateFn: async () => makeState(),
        },
      ),
    ).resolves.toBeUndefined();

    expect(logs).toEqual(["nvst refactor prototype is not implemented yet."]);
  });

  test("builds and invokes full prompt for ide provider", async () => {
    const prompts: string[] = [];

    await expect(
      runRefactorPrototype(
        { provider: "ide" },
        {
          readStateFn: async () => makeState(),
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
