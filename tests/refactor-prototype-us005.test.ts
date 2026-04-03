/**
 * Tests for US-005: `refactor prototype` runs one refactor pass per audit report
 * Iteration: 000044
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import type { AgentInvokeOptions } from "../src/agent";
import { runRefactorPrototype } from "../src/commands/refactor-prototype";
import type { State } from "../src/schemas/tmpl_state";

const PROJECT_ROOT = process.cwd();
const FLOW_DIR = join(PROJECT_ROOT, ".agents", "flow");

function makeState(auditEntries: Array<{ index: number; status: string; file: string | null }>): State {
  return {
    current_iteration: "000044",
    current_phase: "prototype" as const,
    flow_guardrail: "strict",
    last_updated: new Date().toISOString(),
    updated_by: "test",
    phases: {
      define: {
        requirement_definition: [{ index: 1, status: "approved" as const, file: "prd.md" }],
        prd_generation: { status: "completed", file: "it_000044_PRD.json" },
      },
      prototype: {
        prototype_creation: [{ index: 1, status: "completed" as const, file: null }],
        prototype_audit: auditEntries.map((e) => ({
          index: e.index,
          status: e.status as "completed",
          file: e.file,
        })),
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
}

describe("US-005: refactor prototype iterates over all audit entries", () => {
  it("AC01: invokes agent once per audit entry", async () => {
    const state = makeState([
      { index: 1, status: "completed", file: "it_000044_audit-report_001.json" },
      { index: 2, status: "completed", file: "it_000044_audit-report_002.json" },
    ]);
    const invocations: string[] = [];
    let capturedState: State | null = null;

    await runRefactorPrototype(
      { provider: "claude" },
      {
        readStateFn: async () => state,
        loadSkillFn: async () => "auditPath={{audit_json_path}} refactorFile={{refactor_plan_file}}",
        existsFn: async (p) =>
          p.endsWith("it_000044_audit-report_001.json") ||
          p.endsWith("it_000044_audit-report_002.json"),
        invokeAgentFn: async (options: AgentInvokeOptions) => {
          invocations.push(options.prompt);
          return { exitCode: 0, stdout: "", stderr: "" };
        },
        writeStateFn: async (_root, s) => { capturedState = s; },
      },
    );

    expect(invocations).toHaveLength(2);
    expect(capturedState).not.toBeNull();
  });

  it("AC01/AC02: each invocation receives its audit path and numbered refactor plan filename", async () => {
    const state = makeState([
      { index: 1, status: "completed", file: "it_000044_audit-report_001.json" },
      { index: 2, status: "completed", file: "it_000044_audit-report_002.json" },
    ]);
    const prompts: string[] = [];

    await runRefactorPrototype(
      { provider: "claude" },
      {
        readStateFn: async () => state,
        loadSkillFn: async () => "auditPath={{audit_json_path}} refactorFile={{refactor_plan_file}}",
        existsFn: async (p) =>
          p.endsWith("it_000044_audit-report_001.json") ||
          p.endsWith("it_000044_audit-report_002.json"),
        invokeAgentFn: async (options: AgentInvokeOptions) => {
          prompts.push(options.prompt);
          return { exitCode: 0, stdout: "", stderr: "" };
        },
        writeStateFn: async () => {},
      },
    );

    expect(prompts[0]).toContain(join(FLOW_DIR, "it_000044_audit-report_001.json"));
    expect(prompts[0]).toContain("it_000044_refactor-plan_001.md");
    expect(prompts[1]).toContain(join(FLOW_DIR, "it_000044_audit-report_002.json"));
    expect(prompts[1]).toContain("it_000044_refactor-plan_002.md");
  });

  it("AC03: prototype_refactor in state is an array with one entry per audit report", async () => {
    const state = makeState([
      { index: 1, status: "completed", file: "it_000044_audit-report_001.json" },
      { index: 2, status: "completed", file: "it_000044_audit-report_002.json" },
      { index: 3, status: "completed", file: "it_000044_audit-report_003.json" },
    ]);
    let capturedState: State | null = null;

    await runRefactorPrototype(
      { provider: "claude" },
      {
        readStateFn: async () => state,
        loadSkillFn: async () => "skill body {{audit_json_path}}",
        existsFn: async (p) =>
          p.endsWith("it_000044_audit-report_001.json") ||
          p.endsWith("it_000044_audit-report_002.json") ||
          p.endsWith("it_000044_audit-report_003.json"),
        invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        writeStateFn: async (_root, s) => { capturedState = s; },
      },
    );

    const refactorEntries = capturedState!.phases.prototype.prototype_refactor;
    expect(Array.isArray(refactorEntries)).toBe(true);
    expect(refactorEntries).toHaveLength(3);
    expect(refactorEntries![0]).toMatchObject({ index: 1, status: "completed", file: "it_000044_refactor-plan_001.md" });
    expect(refactorEntries![1]).toMatchObject({ index: 2, status: "completed", file: "it_000044_refactor-plan_002.md" });
    expect(refactorEntries![2]).toMatchObject({ index: 3, status: "completed", file: "it_000044_refactor-plan_003.md" });
  });

  it("AC03: state updated_by is set correctly", async () => {
    const state = makeState([
      { index: 1, status: "completed", file: "it_000044_audit-report_001.json" },
    ]);
    let capturedState: State | null = null;

    await runRefactorPrototype(
      { provider: "claude" },
      {
        readStateFn: async () => state,
        loadSkillFn: async () => "skill {{audit_json_path}}",
        existsFn: async (p) => p.endsWith("it_000044_audit-report_001.json"),
        invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        writeStateFn: async (_root, s) => { capturedState = s; },
      },
    );

    expect(capturedState!.updated_by).toBe("nvst:refactor-prototype");
  });

  it("AC02: single-entry refactor artifact is named with _001 suffix", async () => {
    const state = makeState([
      { index: 1, status: "completed", file: "it_000044_audit-report_001.json" },
    ]);
    let capturedState: State | null = null;

    await runRefactorPrototype(
      { provider: "claude" },
      {
        readStateFn: async () => state,
        loadSkillFn: async () => "skill {{audit_json_path}}",
        existsFn: async (p) => p.endsWith("it_000044_audit-report_001.json"),
        invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        writeStateFn: async (_root, s) => { capturedState = s; },
      },
    );

    const refactorEntries = capturedState!.phases.prototype.prototype_refactor;
    expect(refactorEntries![0].file).toBe("it_000044_refactor-plan_001.md");
  });

  it("throws when no audit artifacts are found", async () => {
    const state = makeState([
      { index: 1, status: "completed", file: null },
    ]);

    await expect(
      runRefactorPrototype(
        { provider: "claude" },
        {
          readStateFn: async () => state,
          loadSkillFn: async () => "skill body",
          existsFn: async () => false,
          invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
          writeStateFn: async () => {},
        },
      ),
    ).rejects.toThrow(
      "Audit artifact not found: expected either .agents/flow/it_000044_audit.json or .agents/flow/it_000044_audit.md.",
    );
  });

  it("throws when agent returns non-zero exit code", async () => {
    const state = makeState([
      { index: 1, status: "completed", file: "it_000044_audit-report_001.json" },
    ]);

    await expect(
      runRefactorPrototype(
        { provider: "claude" },
        {
          readStateFn: async () => state,
          loadSkillFn: async () => "skill {{audit_json_path}}",
          existsFn: async (p) => p.endsWith("it_000044_audit-report_001.json"),
          invokeAgentFn: async () => ({ exitCode: 1, stdout: "", stderr: "error" }),
          writeStateFn: async () => {},
        },
      ),
    ).rejects.toThrow("Agent invocation failed with exit code 1 for audit entry 001.");
  });
});
