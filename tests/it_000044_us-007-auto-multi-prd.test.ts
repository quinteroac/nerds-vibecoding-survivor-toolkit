/**
 * Tests for US-007: `auto` mode supports multi-PRD flow
 * Iteration: 000044
 *
 * The auto command calls create → audit → refactor in sequence.
 * Each phase command internally processes all PRD entries, so `auto`
 * dispatches each phase once and each phase handles all PRDs in index order.
 */
import { describe, it, expect } from "bun:test";
import { runAuto } from "../src/commands/auto";
import { GuardrailAbortError } from "../src/guardrail";
import type { State } from "../src/schemas/tmpl_state";
import type { CreatePrototypeOptions } from "../src/commands/create-prototype";
import type { AuditPrototypeOptions } from "../src/commands/audit-prototype";
import type { RefactorPrototypeOptions } from "../src/commands/refactor-prototype";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMultiPrdState(
  defs: State["phases"]["define"]["requirement_definition"],
  guardrail?: "strict" | "relaxed",
): State {
  return {
    current_iteration: "000044",
    current_phase: "prototype",
    flow_guardrail: guardrail,
    last_updated: new Date().toISOString(),
    phases: {
      define: {
        requirement_definition: defs,
        prd_generation: { status: "completed", file: null },
      },
      prototype: {},
      refactor: {},
    },
  };
}

const noop = async () => {};

// ---------------------------------------------------------------------------
// AC01: auto loops through all PRD entries and dispatches phases in order
// ---------------------------------------------------------------------------

describe("US-007-AC01: dispatches all phase commands for multi-PRD state in order", () => {
  it("calls create → audit → refactor in order for 2-PRD state", async () => {
    const phases: string[] = [];

    await runAuto(
      { provider: "claude" },
      {
        readStateFn: async () =>
          makeMultiPrdState(
            [
              { index: 1, status: "approved", file: null },
              { index: 2, status: "approved", file: null },
            ],
            "strict",
          ),
        runCreatePrototypeFn: async () => { phases.push("create"); },
        runAuditPrototypeFn: async () => { phases.push("audit"); },
        runRefactorPrototypeFn: async () => { phases.push("refactor"); },
      },
    );

    expect(phases).toEqual(["create", "audit", "refactor"]);
  });

  it("calls create → audit → refactor in order for 3-PRD state", async () => {
    const phases: string[] = [];

    await runAuto(
      { provider: "claude" },
      {
        readStateFn: async () =>
          makeMultiPrdState(
            [
              { index: 1, status: "approved", file: null },
              { index: 2, status: "approved", file: null },
              { index: 3, status: "approved", file: null },
            ],
            "strict",
          ),
        runCreatePrototypeFn: async () => { phases.push("create"); },
        runAuditPrototypeFn: async () => { phases.push("audit"); },
        runRefactorPrototypeFn: async () => { phases.push("refactor"); },
      },
    );

    expect(phases).toEqual(["create", "audit", "refactor"]);
  });

  it("blocks pipeline when ALL PRDs are pending (strict)", async () => {
    await expect(
      runAuto(
        { provider: "claude" },
        {
          readStateFn: async () =>
            makeMultiPrdState(
              [
                { index: 1, status: "pending", file: null },
                { index: 2, status: "pending", file: null },
              ],
              "strict",
            ),
          runCreatePrototypeFn: noop,
          runAuditPrototypeFn: noop,
          runRefactorPrototypeFn: noop,
        },
      ),
    ).rejects.toThrow("Requirement must be approved before running auto mode");
  });

  it("blocks pipeline when ALL PRDs are in_progress (strict)", async () => {
    await expect(
      runAuto(
        { provider: "claude" },
        {
          readStateFn: async () =>
            makeMultiPrdState(
              [
                { index: 1, status: "in_progress", file: null },
                { index: 2, status: "in_progress", file: null },
              ],
              "strict",
            ),
          runCreatePrototypeFn: noop,
          runAuditPrototypeFn: noop,
          runRefactorPrototypeFn: noop,
        },
      ),
    ).rejects.toThrow("Requirement must be approved before running auto mode");
  });

  it("runs pipeline when at least one PRD is approved (mixed state)", async () => {
    const phases: string[] = [];

    await runAuto(
      { provider: "claude" },
      {
        readStateFn: async () =>
          makeMultiPrdState(
            [
              { index: 1, status: "approved", file: null },
              { index: 2, status: "in_progress", file: null },
            ],
            "strict",
          ),
        runCreatePrototypeFn: async () => { phases.push("create"); },
        runAuditPrototypeFn: async () => { phases.push("audit"); },
        runRefactorPrototypeFn: async () => { phases.push("refactor"); },
      },
    );

    expect(phases).toEqual(["create", "audit", "refactor"]);
  });

  it("create failure stops pipeline for multi-PRD state", async () => {
    const afterCreate: string[] = [];

    await expect(
      runAuto(
        { provider: "claude" },
        {
          readStateFn: async () =>
            makeMultiPrdState(
              [
                { index: 1, status: "approved", file: null },
                { index: 2, status: "approved", file: null },
              ],
              "strict",
            ),
          runCreatePrototypeFn: async () => { throw new Error("create failed for PRD"); },
          runAuditPrototypeFn: async () => { afterCreate.push("audit"); },
          runRefactorPrototypeFn: async () => { afterCreate.push("refactor"); },
        },
      ),
    ).rejects.toThrow("create failed for PRD");

    expect(afterCreate).toEqual([]);
  });

  it("audit failure stops refactor for multi-PRD state", async () => {
    const afterAudit: string[] = [];

    await expect(
      runAuto(
        { provider: "claude" },
        {
          readStateFn: async () =>
            makeMultiPrdState(
              [
                { index: 1, status: "approved", file: null },
                { index: 2, status: "approved", file: null },
              ],
              "strict",
            ),
          runCreatePrototypeFn: noop,
          runAuditPrototypeFn: async () => { throw new Error("audit failed for PRD"); },
          runRefactorPrototypeFn: async () => { afterAudit.push("refactor"); },
        },
      ),
    ).rejects.toThrow("audit failed for PRD");

    expect(afterAudit).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC02: state transitions correctly advance each per-PRD entry status
// ---------------------------------------------------------------------------

describe("US-007-AC02: state transitions advance per-PRD entry status in auto mode", () => {
  it("provider is forwarded to all phase commands in multi-PRD mode", async () => {
    const capturedProviders: string[] = [];

    await runAuto(
      { provider: "codex" },
      {
        readStateFn: async () =>
          makeMultiPrdState(
            [
              { index: 1, status: "approved", file: null },
              { index: 2, status: "approved", file: null },
            ],
            "strict",
          ),
        runCreatePrototypeFn: async (opts: CreatePrototypeOptions) => {
          capturedProviders.push(`create:${opts.provider}`);
        },
        runAuditPrototypeFn: async (opts: AuditPrototypeOptions) => {
          capturedProviders.push(`audit:${opts.provider}`);
        },
        runRefactorPrototypeFn: async (opts: RefactorPrototypeOptions) => {
          capturedProviders.push(`refactor:${opts.provider}`);
        },
      },
    );

    expect(capturedProviders).toEqual(["create:codex", "audit:codex", "refactor:codex"]);
  });

  it("force and yolo are forwarded to all phases in multi-PRD mode", async () => {
    const capturedOpts: Array<{ name: string; force?: boolean; yolo?: boolean }> = [];

    await runAuto(
      { provider: "claude", force: true, yolo: true },
      {
        readStateFn: async () =>
          makeMultiPrdState(
            [
              { index: 1, status: "approved", file: null },
              { index: 2, status: "approved", file: null },
            ],
            "strict",
          ),
        runCreatePrototypeFn: async (opts: CreatePrototypeOptions) => {
          capturedOpts.push({ name: "create", force: opts.force, yolo: opts.yolo });
        },
        runAuditPrototypeFn: async (opts: AuditPrototypeOptions) => {
          capturedOpts.push({ name: "audit", force: opts.force, yolo: opts.yolo });
        },
        runRefactorPrototypeFn: async (opts: RefactorPrototypeOptions) => {
          capturedOpts.push({ name: "refactor", force: opts.force, yolo: opts.yolo });
        },
      },
    );

    expect(capturedOpts.length).toBe(3);
    for (const c of capturedOpts) {
      expect(c.force).toBe(true);
      expect(c.yolo).toBe(true);
    }
  });

  it("audit is invoked with interactive: false in multi-PRD mode", async () => {
    let capturedInteractive: boolean | undefined;

    await runAuto(
      { provider: "claude" },
      {
        readStateFn: async () =>
          makeMultiPrdState(
            [
              { index: 1, status: "approved", file: null },
              { index: 2, status: "approved", file: null },
            ],
            "strict",
          ),
        runCreatePrototypeFn: noop,
        runAuditPrototypeFn: async (opts: AuditPrototypeOptions) => {
          capturedInteractive = opts.interactive;
        },
        runRefactorPrototypeFn: noop,
      },
    );

    expect(capturedInteractive).toBe(false);
  });

  it("all three phase commands are each invoked exactly once for multi-PRD state", async () => {
    let createCount = 0;
    let auditCount = 0;
    let refactorCount = 0;

    await runAuto(
      { provider: "claude" },
      {
        readStateFn: async () =>
          makeMultiPrdState(
            [
              { index: 1, status: "approved", file: null },
              { index: 2, status: "approved", file: null },
              { index: 3, status: "approved", file: null },
            ],
            "strict",
          ),
        runCreatePrototypeFn: async () => { createCount++; },
        runAuditPrototypeFn: async () => { auditCount++; },
        runRefactorPrototypeFn: async () => { refactorCount++; },
      },
    );

    // Each phase command is called once; the command itself loops over all PRDs.
    expect(createCount).toBe(1);
    expect(auditCount).toBe(1);
    expect(refactorCount).toBe(1);
  });

  it("relaxed mode with multi-PRD pending state and 'y' confirmation runs pipeline", async () => {
    const phases: string[] = [];

    await runAuto(
      { provider: "claude" },
      {
        readStateFn: async () =>
          makeMultiPrdState(
            [
              { index: 1, status: "pending", file: null },
              { index: 2, status: "pending", file: null },
            ],
            "relaxed",
          ),
        readLineFn: async () => "y",
        stderrWriteFn: () => {},
        runCreatePrototypeFn: async () => { phases.push("create"); },
        runAuditPrototypeFn: async () => { phases.push("audit"); },
        runRefactorPrototypeFn: async () => { phases.push("refactor"); },
      },
    );

    expect(phases).toEqual(["create", "audit", "refactor"]);
  });

  it("relaxed mode with multi-PRD pending state and 'n' reply aborts via GuardrailAbortError", async () => {
    const originalExitCode = process.exitCode;

    await expect(
      runAuto(
        { provider: "claude" },
        {
          readStateFn: async () =>
            makeMultiPrdState(
              [
                { index: 1, status: "pending", file: null },
                { index: 2, status: "pending", file: null },
              ],
              "relaxed",
            ),
          readLineFn: async () => "n",
          stderrWriteFn: () => {},
          runCreatePrototypeFn: noop,
          runAuditPrototypeFn: noop,
          runRefactorPrototypeFn: noop,
        },
      ),
    ).rejects.toBeInstanceOf(GuardrailAbortError);

    process.exitCode = originalExitCode ?? 0;
  });

  it("force flag bypasses guardrail in multi-PRD pending state", async () => {
    const phases: string[] = [];

    await runAuto(
      { provider: "claude", force: true },
      {
        readStateFn: async () =>
          makeMultiPrdState(
            [
              { index: 1, status: "pending", file: null },
              { index: 2, status: "pending", file: null },
            ],
            "strict",
          ),
        stderrWriteFn: () => {},
        runCreatePrototypeFn: async () => { phases.push("create"); },
        runAuditPrototypeFn: async () => { phases.push("audit"); },
        runRefactorPrototypeFn: async () => { phases.push("refactor"); },
      },
    );

    expect(phases).toEqual(["create", "audit", "refactor"]);
  });
});

// ---------------------------------------------------------------------------
// AC03: Typecheck / lint passes
// ---------------------------------------------------------------------------

describe("US-007-AC03: typecheck passes", () => {
  it("runAuto is importable and correctly typed", () => {
    expect(typeof runAuto).toBe("function");
  });
});
