/**
 * Tests for US-002: Enforce requirement-approved guard on `nvst auto`
 * Iteration: 000042
 */
import { describe, it, expect } from "bun:test";
import { runAuto } from "../src/commands/auto";
import { GuardrailAbortError } from "../src/guardrail";
import type { State } from "../src/schemas/tmpl_state";

function makeState(
  reqStatus: "pending" | "in_progress" | "approved",
  guardrail?: "strict" | "relaxed",
): State {
  const requirementDefinition =
    reqStatus === "approved"
      ? [{ index: 1 as const, status: "approved" as const, file: null }]
      : reqStatus === "in_progress"
        ? [{ index: 1 as const, status: "in_progress" as const, file: null }]
        : ([] as State["phases"]["define"]["requirement_definition"]);
  return {
    current_iteration: "000042",
    current_phase: "prototype",
    flow_guardrail: guardrail,
    last_updated: new Date().toISOString(),
    phases: {
      define: {
        requirement_definition: requirementDefinition,
        prd_generation: { status: "completed", file: null },
      },
      prototype: {},
      refactor: {},
    },
  };
}

const noop = async () => {};

// ---------------------------------------------------------------------------
// AC01 + AC02: throws with clear error if requirement is not approved
// ---------------------------------------------------------------------------

describe("US-002-AC01 + AC02: throws when requirement is not approved (strict mode)", () => {
  it("throws when status is 'pending'", async () => {
    await expect(
      runAuto(
        { provider: "claude" },
        {
          readStateFn: async () => makeState("pending", "strict"),
          runCreatePrototypeFn: noop,
          runAuditPrototypeFn: noop,
          runRefactorPrototypeFn: noop,
        },
      ),
    ).rejects.toThrow("Requirement must be approved before running auto mode");
  });

  it("throws when status is 'in_progress'", async () => {
    await expect(
      runAuto(
        { provider: "claude" },
        {
          readStateFn: async () => makeState("in_progress", "strict"),
          runCreatePrototypeFn: noop,
          runAuditPrototypeFn: noop,
          runRefactorPrototypeFn: noop,
        },
      ),
    ).rejects.toThrow("Requirement must be approved before running auto mode");
  });

  it("error message mentions approve requirement", async () => {
    let caughtMessage = "";
    try {
      await runAuto(
        { provider: "claude" },
        {
          readStateFn: async () => makeState("pending", "strict"),
          runCreatePrototypeFn: noop,
          runAuditPrototypeFn: noop,
          runRefactorPrototypeFn: noop,
        },
      );
    } catch (e) {
      caughtMessage = e instanceof Error ? e.message : String(e);
    }
    expect(caughtMessage).toContain("approve requirement");
  });

  it("does not throw when status is 'approved'", async () => {
    const calls: string[] = [];
    await runAuto(
      { provider: "claude" },
      {
        readStateFn: async () => makeState("approved", "strict"),
        runCreatePrototypeFn: async () => { calls.push("create"); },
        runAuditPrototypeFn: async () => { calls.push("audit"); },
        runRefactorPrototypeFn: async () => { calls.push("refactor"); },
      },
    );
    expect(calls).toEqual(["create", "audit", "refactor"]);
  });
});

// ---------------------------------------------------------------------------
// AC03: guardrail respects flow_guardrail mode
// ---------------------------------------------------------------------------

describe("US-002-AC03: respects flow_guardrail mode", () => {
  it("strict mode throws an Error (not GuardrailAbortError)", async () => {
    let caught: unknown;
    try {
      await runAuto(
        { provider: "claude" },
        {
          readStateFn: async () => makeState("pending", "strict"),
          runCreatePrototypeFn: noop,
          runAuditPrototypeFn: noop,
          runRefactorPrototypeFn: noop,
        },
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(GuardrailAbortError);
  });

  it("relaxed mode without confirmation aborts via GuardrailAbortError", async () => {
    const originalExitCode = process.exitCode;
    await expect(
      runAuto(
        { provider: "claude" },
        {
          readStateFn: async () => makeState("pending", "relaxed"),
          readLineFn: async () => "n",
          stderrWriteFn: () => {},
          runCreatePrototypeFn: noop,
          runAuditPrototypeFn: noop,
          runRefactorPrototypeFn: noop,
        },
      ),
    ).rejects.toBeInstanceOf(GuardrailAbortError);
    process.exitCode = originalExitCode;
  });

  it("relaxed mode with 'y' confirmation proceeds to pipeline", async () => {
    const calls: string[] = [];
    await runAuto(
      { provider: "claude" },
      {
        readStateFn: async () => makeState("pending", "relaxed"),
        readLineFn: async () => "y",
        stderrWriteFn: () => {},
        runCreatePrototypeFn: async () => { calls.push("create"); },
        runAuditPrototypeFn: async () => { calls.push("audit"); },
        runRefactorPrototypeFn: async () => { calls.push("refactor"); },
      },
    );
    expect(calls).toEqual(["create", "audit", "refactor"]);
  });

  it("relaxed mode prints warning to stderr", async () => {
    const warnings: string[] = [];
    await runAuto(
      { provider: "claude" },
      {
        readStateFn: async () => makeState("pending", "relaxed"),
        readLineFn: async () => "y",
        stderrWriteFn: (msg) => { warnings.push(msg); },
        runCreatePrototypeFn: noop,
        runAuditPrototypeFn: noop,
        runRefactorPrototypeFn: noop,
      },
    ).catch(() => {});
    expect(warnings.some((w) => w.includes("Requirement must be approved before running auto mode"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC04: --force bypasses confirmation prompt (warning still printed)
// ---------------------------------------------------------------------------

describe("US-002-AC04: --force bypasses confirmation, warning still printed", () => {
  it("force + strict: prints warning and proceeds without throwing", async () => {
    const warnings: string[] = [];
    const calls: string[] = [];
    await runAuto(
      { provider: "claude", force: true },
      {
        readStateFn: async () => makeState("pending", "strict"),
        stderrWriteFn: (msg) => { warnings.push(msg); },
        runCreatePrototypeFn: async () => { calls.push("create"); },
        runAuditPrototypeFn: async () => { calls.push("audit"); },
        runRefactorPrototypeFn: async () => { calls.push("refactor"); },
      },
    );
    expect(warnings.some((w) => w.includes("Requirement must be approved before running auto mode"))).toBe(true);
    expect(calls).toEqual(["create", "audit", "refactor"]);
  });

  it("force + relaxed: prints warning and proceeds without confirmation prompt", async () => {
    const warnings: string[] = [];
    const promptCalled: boolean[] = [];
    const calls: string[] = [];
    await runAuto(
      { provider: "claude", force: true },
      {
        readStateFn: async () => makeState("pending", "relaxed"),
        readLineFn: async () => { promptCalled.push(true); return "n"; },
        stderrWriteFn: (msg) => { warnings.push(msg); },
        runCreatePrototypeFn: async () => { calls.push("create"); },
        runAuditPrototypeFn: async () => { calls.push("audit"); },
        runRefactorPrototypeFn: async () => { calls.push("refactor"); },
      },
    );
    expect(warnings.some((w) => w.includes("Requirement must be approved before running auto mode"))).toBe(true);
    // readLineFn (confirmation) must NOT have been called
    expect(promptCalled).toHaveLength(0);
    expect(calls).toEqual(["create", "audit", "refactor"]);
  });
});
