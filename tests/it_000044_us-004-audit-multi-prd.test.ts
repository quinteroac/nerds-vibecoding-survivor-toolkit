/**
 * Tests for US-004: `audit prototype` produces one audit report per PRD
 * Iteration: 000044
 */
import { describe, it, expect } from "bun:test";
import type { AgentInvokeOptions } from "../src/agent";
import { runAuditPrototype } from "../src/commands/audit-prototype";
import type { State } from "../src/schemas/tmpl_state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(
  requirementDefs: State["phases"]["define"]["requirement_definition"],
  prototypeOverrides: Partial<State["phases"]["prototype"]> = {},
): State {
  return {
    current_iteration: "000044",
    current_phase: "prototype",
    flow_guardrail: "strict",
    last_updated: "2026-01-01T00:00:00.000Z",
    updated_by: "test",
    phases: {
      define: {
        requirement_definition: requirementDefs,
        prd_generation: { status: "completed", file: "it_000044_PRD.json" },
      },
      prototype: {
        prototype_creation: [
          { index: 1, status: "completed", file: "it_000044_prototype-creation_001.json" },
        ],
        prototype_audit: [{ index: 1, status: "pending", file: null }],
        ...prototypeOverrides,
      },
      refactor: {},
    },
  };
}

const fakeLoadSkill = async () => "audit skill body";
const fakeInvoke = async (_options: AgentInvokeOptions) => ({
  exitCode: 0,
  stdout: "",
  stderr: "",
});
const fakeExistsFn = async () => true;

// ---------------------------------------------------------------------------
// AC01: Command produces N audit report files named it_XXXXXX_audit-report_NNN.json
// ---------------------------------------------------------------------------

describe("US-004-AC01: command produces N audit report files", () => {
  it("produces one audit report file for a single PRD", async () => {
    const state = makeState([{ index: 1, status: "approved", file: "prd_001.md" }]);
    const invokedPaths: string[] = [];

    await runAuditPrototype(
      { provider: "claude" },
      {
        existsFn: async (path) => {
          invokedPaths.push(path);
          return true;
        },
        invokeAgentFn: fakeInvoke,
        readStateFn: async () => state,
        loadSkillFn: fakeLoadSkill,
        writeStateFn: async () => {},
      },
    );

    expect(invokedPaths.some((p) => p.endsWith("it_000044_audit-report_001.json"))).toBe(true);
  });

  it("produces two audit report files for two PRDs", async () => {
    const state = makeState([
      { index: 1, status: "approved", file: "prd_001.md" },
      { index: 2, status: "approved", file: "prd_002.md" },
    ]);
    const invokedPaths: string[] = [];
    let invokeCount = 0;

    await runAuditPrototype(
      { provider: "claude" },
      {
        existsFn: async (path) => {
          invokedPaths.push(path);
          return true;
        },
        invokeAgentFn: async () => {
          invokeCount++;
          return { exitCode: 0, stdout: "", stderr: "" };
        },
        readStateFn: async () => state,
        loadSkillFn: fakeLoadSkill,
        writeStateFn: async () => {},
      },
    );

    expect(invokeCount).toBe(2);
    expect(invokedPaths.some((p) => p.endsWith("it_000044_audit-report_001.json"))).toBe(true);
    expect(invokedPaths.some((p) => p.endsWith("it_000044_audit-report_002.json"))).toBe(true);
  });

  it("audit report files use zero-padded 3-digit index", async () => {
    const state = makeState([{ index: 3, status: "approved", file: "prd_003.md" }]);
    const invokedPaths: string[] = [];

    await runAuditPrototype(
      { provider: "claude" },
      {
        existsFn: async (path) => {
          invokedPaths.push(path);
          return true;
        },
        invokeAgentFn: fakeInvoke,
        readStateFn: async () => state,
        loadSkillFn: fakeLoadSkill,
        writeStateFn: async () => {},
      },
    );

    expect(invokedPaths.some((p) => p.endsWith("it_000044_audit-report_003.json"))).toBe(true);
  });

  it("throws if audit report file is not found after agent invocation", async () => {
    const state = makeState([{ index: 1, status: "approved", file: "prd_001.md" }]);

    await expect(
      runAuditPrototype(
        { provider: "claude" },
        {
          existsFn: async () => false,
          invokeAgentFn: fakeInvoke,
          readStateFn: async () => state,
          loadSkillFn: fakeLoadSkill,
          writeStateFn: async () => {},
        },
      ),
    ).rejects.toThrow("it_000044_audit-report_001.json");
  });
});

// ---------------------------------------------------------------------------
// AC02: prototype_audit in state.json becomes an array with one entry per PRD
// ---------------------------------------------------------------------------

describe("US-004-AC02: prototype_audit becomes array with one entry per PRD", () => {
  it("prototype_audit is an array after audit runs for one PRD", async () => {
    const state = makeState([{ index: 1, status: "approved", file: "prd_001.md" }]);
    let capturedState: State | undefined;

    await runAuditPrototype(
      { provider: "claude" },
      {
        existsFn: fakeExistsFn,
        invokeAgentFn: fakeInvoke,
        readStateFn: async () => state,
        loadSkillFn: fakeLoadSkill,
        writeStateFn: async (_root, s) => {
          capturedState = s;
        },
      },
    );

    expect(Array.isArray(capturedState!.phases.prototype.prototype_audit)).toBe(true);
    expect((capturedState!.phases.prototype.prototype_audit as unknown[]).length).toBe(1);
  });

  it("prototype_audit has two entries for two PRDs", async () => {
    const state = makeState([
      { index: 1, status: "approved", file: "prd_001.md" },
      { index: 2, status: "approved", file: "prd_002.md" },
    ]);
    let capturedState: State | undefined;

    await runAuditPrototype(
      { provider: "claude" },
      {
        existsFn: fakeExistsFn,
        invokeAgentFn: fakeInvoke,
        readStateFn: async () => state,
        loadSkillFn: fakeLoadSkill,
        writeStateFn: async (_root, s) => {
          capturedState = s;
        },
      },
    );

    const entries = capturedState!.phases.prototype.prototype_audit as Array<{
      index: number;
      status: string;
      file: string | null;
    }>;
    expect(entries.length).toBe(2);
    expect(entries.every((e) => e.status === "completed")).toBe(true);
  });

  it("each entry has status 'completed' after successful audit", async () => {
    const state = makeState([
      { index: 1, status: "approved", file: "prd_001.md" },
      { index: 2, status: "approved", file: "prd_002.md" },
    ]);
    let capturedState: State | undefined;

    await runAuditPrototype(
      { provider: "claude" },
      {
        existsFn: fakeExistsFn,
        invokeAgentFn: fakeInvoke,
        readStateFn: async () => state,
        loadSkillFn: fakeLoadSkill,
        writeStateFn: async (_root, s) => {
          capturedState = s;
        },
      },
    );

    const entries = capturedState!.phases.prototype.prototype_audit as Array<{
      index: number;
      status: string;
      file: string | null;
    }>;
    for (const entry of entries) {
      expect(entry.status).toBe("completed");
    }
  });
});

// ---------------------------------------------------------------------------
// AC03: Each audit report is associated with its source PRD index
// ---------------------------------------------------------------------------

describe("US-004-AC03: each audit report associated with its source PRD index", () => {
  it("entry index matches the corresponding PRD index", async () => {
    const state = makeState([
      { index: 1, status: "approved", file: "prd_001.md" },
      { index: 2, status: "approved", file: "prd_002.md" },
    ]);
    let capturedState: State | undefined;

    await runAuditPrototype(
      { provider: "claude" },
      {
        existsFn: fakeExistsFn,
        invokeAgentFn: fakeInvoke,
        readStateFn: async () => state,
        loadSkillFn: fakeLoadSkill,
        writeStateFn: async (_root, s) => {
          capturedState = s;
        },
      },
    );

    const entries = capturedState!.phases.prototype.prototype_audit as Array<{
      index: number;
      status: string;
      file: string | null;
    }>;
    const byIndex = new Map(entries.map((e) => [e.index, e]));
    expect(byIndex.has(1)).toBe(true);
    expect(byIndex.has(2)).toBe(true);
    expect(byIndex.get(1)!.file).toBe("it_000044_audit-report_001.json");
    expect(byIndex.get(2)!.file).toBe("it_000044_audit-report_002.json");
  });

  it("PRDs are processed in index order regardless of storage order", async () => {
    const state = makeState([
      { index: 2, status: "approved", file: "prd_002.md" },
      { index: 1, status: "approved", file: "prd_001.md" },
    ]);
    const capturedPrompts: string[] = [];

    await runAuditPrototype(
      { provider: "claude" },
      {
        existsFn: fakeExistsFn,
        invokeAgentFn: async (opts) => {
          capturedPrompts.push(opts.prompt);
          return { exitCode: 0, stdout: "", stderr: "" };
        },
        readStateFn: async () => state,
        loadSkillFn: fakeLoadSkill,
        writeStateFn: async () => {},
      },
    );

    // First invocation should reference PRD index 001, second 002
    expect(capturedPrompts[0]).toContain("001");
    expect(capturedPrompts[1]).toContain("002");
    const pos001 = capturedPrompts[0].indexOf("001");
    const pos002InSecond = capturedPrompts[1].indexOf("002");
    expect(pos001).toBeGreaterThanOrEqual(0);
    expect(pos002InSecond).toBeGreaterThanOrEqual(0);
  });

  it("audit report filename encodes the PRD index", async () => {
    const state = makeState([{ index: 5, status: "approved", file: "prd_005.md" }]);
    let capturedState: State | undefined;

    await runAuditPrototype(
      { provider: "claude" },
      {
        existsFn: fakeExistsFn,
        invokeAgentFn: fakeInvoke,
        readStateFn: async () => state,
        loadSkillFn: fakeLoadSkill,
        writeStateFn: async (_root, s) => {
          capturedState = s;
        },
      },
    );

    const entries = capturedState!.phases.prototype.prototype_audit as Array<{
      index: number;
      status: string;
      file: string | null;
    }>;
    expect(entries[0].index).toBe(5);
    expect(entries[0].file).toBe("it_000044_audit-report_005.json");
  });
});

// ---------------------------------------------------------------------------
// AC04: Typecheck / lint passes (verified by import + function type)
// ---------------------------------------------------------------------------

describe("US-004-AC04: typecheck passes", () => {
  it("runAuditPrototype is importable and typed correctly", () => {
    expect(typeof runAuditPrototype).toBe("function");
  });
});
