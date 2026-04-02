/**
 * Tests for US-001: Allow `refactor prototype` to use audit.md fallback
 * Iteration: 000043
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import type { AgentInvokeOptions } from "../src/agent";
import { runRefactorPrototype } from "../src/commands/refactor-prototype";
import type { State } from "../src/schemas/tmpl_state";

const PROJECT_ROOT = process.cwd();
const FLOW_DIR = join(PROJECT_ROOT, ".agents", "flow");

const fakeState: State = {
  current_iteration: "000043",
  current_phase: "prototype" as const,
  flow_guardrail: "strict",
  last_updated: new Date().toISOString(),
  updated_by: "test",
  phases: {
    define: {
      requirement_definition: { status: "approved" as const, file: "prd.md" },
      prd_generation: { status: "completed", file: "it_000043_PRD.json" },
    },
    prototype: {
      project_context: { status: "created" as const, file: "ctx.md" },
      prototype_creation: { status: "completed" as const, file: null },
      prototype_audit: { status: "completed" as const, file: null },
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
};

describe("US-001: refactor prototype audit artifact resolution", () => {
  it("AC01: prefers audit JSON when both artifacts are available", async () => {
    let capturedPrompt = "";

    await runRefactorPrototype(
      { provider: "claude" },
      {
        readStateFn: async () => fakeState,
        loadSkillFn: async () => "auditPath={{audit_json_path}}",
        existsFn: async (path) => path.endsWith("it_000043_audit.json"),
        invokeAgentFn: async (options: AgentInvokeOptions) => {
          capturedPrompt = options.prompt;
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      },
    );

    expect(capturedPrompt).toContain(join(FLOW_DIR, "it_000043_audit.json"));
  });

  it("AC02: falls back to audit markdown when JSON artifact is missing", async () => {
    let capturedPrompt = "";

    await runRefactorPrototype(
      { provider: "claude" },
      {
        readStateFn: async () => fakeState,
        loadSkillFn: async () => "auditPath={{audit_json_path}}",
        existsFn: async (path) => path.endsWith("it_000043_audit.md"),
        invokeAgentFn: async (options: AgentInvokeOptions) => {
          capturedPrompt = options.prompt;
          return { exitCode: 0, stdout: "", stderr: "" };
        },
      },
    );

    expect(capturedPrompt).toContain(join(FLOW_DIR, "it_000043_audit.md"));
  });

  it("AC03: throws a clear error when neither audit artifact exists", async () => {
    await expect(
      runRefactorPrototype(
        { provider: "claude" },
        {
          readStateFn: async () => fakeState,
          loadSkillFn: async () => "skill body",
          existsFn: async () => false,
          invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        },
      ),
    ).rejects.toThrow(
      "Audit artifact not found: expected either .agents/flow/it_000043_audit.json or .agents/flow/it_000043_audit.md.",
    );
  });
});
