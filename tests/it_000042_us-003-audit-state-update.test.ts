/**
 * Tests for US-003: Fix `audit prototype` state update on completion
 * Iteration: 000042
 */
import { describe, it, expect } from "bun:test";
import type { AgentInvokeOptions } from "../src/agent";
import { runAuditPrototype } from "../src/commands/audit-prototype";
import type { State } from "../src/schemas/tmpl_state";

function makeState(overrides: Partial<State["phases"]["prototype"]> = {}): State {
  return {
    current_iteration: "000042",
    current_phase: "prototype",
    flow_guardrail: "strict",
    last_updated: "2024-01-01T00:00:00.000Z",
    updated_by: "test",
    phases: {
      define: {
        ideation: undefined,
        requirement_definition: [{ index: 1, status: "approved", file: "prd.md" }],
        prd_generation: { status: "completed", file: null },
      },
      prototype: {
        project_context: { status: "created", file: "ctx.md" },
        prototype_creation: [{ index: 1, status: "completed", file: null }],
        prototype_audit: [{ index: 1, status: "pending", file: null }],
        prototype_refactor: undefined,
        prototype_approval: undefined,
        ...overrides,
      },
      refactor: {},
    },
  };
}

const fakeLoadSkill = async () => "skill body";
const fakeInvoke = async (_options: AgentInvokeOptions) => ({
  exitCode: 0,
  stdout: "",
  stderr: "",
});
const fakeExistsFn = async () => true;

// ---------------------------------------------------------------------------
// AC01: prototype_audit.status → "completed" after successful run
// ---------------------------------------------------------------------------

describe("US-003-AC01: prototype_audit.status is set to completed", () => {
  it("sets prototype_audit.status to 'completed' after successful agent invocation", async () => {
    let capturedState: State | undefined;

    await runAuditPrototype(
      { provider: "claude" },
      {
        existsFn: fakeExistsFn,
        invokeAgentFn: fakeInvoke,
        readStateFn: async () => makeState(),
        loadSkillFn: fakeLoadSkill,
        writeStateFn: async (_root, state) => {
          capturedState = state;
        },
      },
    );

    expect(capturedState).toBeDefined();
    expect(capturedState!.phases.prototype.prototype_audit?.[0]?.status).toBe("completed");
  });

  it("audit report entry file matches expected naming convention", async () => {
    let capturedState: State | undefined;

    await runAuditPrototype(
      { provider: "claude" },
      {
        existsFn: fakeExistsFn,
        invokeAgentFn: fakeInvoke,
        readStateFn: async () => makeState(),
        loadSkillFn: fakeLoadSkill,
        writeStateFn: async (_root, state) => {
          capturedState = state;
        },
      },
    );

    const entries = capturedState!.phases.prototype.prototype_audit as Array<{
      index: number;
      status: string;
      file: string | null;
    }>;
    expect(entries.length).toBe(1);
    expect(entries[0].file).toBe("it_000042_audit-report_001.json");
  });
});

// ---------------------------------------------------------------------------
// AC02: last_updated and updated_by are set after completion
// ---------------------------------------------------------------------------

describe("US-003-AC02: last_updated and updated_by are set", () => {
  it("sets updated_by to 'nvst:audit-prototype'", async () => {
    let capturedState: State | undefined;

    await runAuditPrototype(
      { provider: "claude" },
      {
        existsFn: fakeExistsFn,
        invokeAgentFn: fakeInvoke,
        readStateFn: async () => makeState(),
        loadSkillFn: fakeLoadSkill,
        writeStateFn: async (_root, state) => {
          capturedState = state;
        },
      },
    );

    expect(capturedState!.updated_by).toBe("nvst:audit-prototype");
  });

  it("writeState is called (which sets last_updated via writeState internals)", async () => {
    let writeStateCalled = false;

    await runAuditPrototype(
      { provider: "claude" },
      {
        existsFn: fakeExistsFn,
        invokeAgentFn: fakeInvoke,
        readStateFn: async () => makeState(),
        loadSkillFn: fakeLoadSkill,
        writeStateFn: async () => {
          writeStateCalled = true;
        },
      },
    );

    expect(writeStateCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC03: refactorAllowed guard passes immediately after audit completes
// ---------------------------------------------------------------------------

describe("US-003-AC03: refactor prototype can run after audit without --force", () => {
  it("prototype_audit.status 'completed' satisfies refactorAllowed guard", async () => {
    // We verify this indirectly: after runAuditPrototype, the persisted state
    // has status 'completed', which is != 'pending' and satisfies refactorAllowed.
    let persistedStatus: string | undefined;

    await runAuditPrototype(
      { provider: "claude" },
      {
        existsFn: fakeExistsFn,
        invokeAgentFn: fakeInvoke,
        readStateFn: async () => makeState(),
        loadSkillFn: fakeLoadSkill,
        writeStateFn: async (_root, state) => {
          persistedStatus = state.phases.prototype.prototype_audit?.[0]?.status;
        },
      },
    );

    // refactorAllowed checks: prototypeAudit.status !== "pending"
    expect(persistedStatus).not.toBe("pending");
    expect(persistedStatus).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// AC04: auditAllowed guard logic is not broken
// ---------------------------------------------------------------------------

describe("US-003-AC04: auditAllowed guard still works correctly", () => {
  it("throws when current_phase is not prototype", async () => {
    const nonPrototypeState: State = {
      ...makeState(),
      current_phase: "define",
    };

    await expect(
      runAuditPrototype(
        { provider: "claude", force: false },
        {
          invokeAgentFn: fakeInvoke,
          readStateFn: async () => nonPrototypeState,
          loadSkillFn: fakeLoadSkill,
          writeStateFn: async () => {},
        },
      ),
    ).rejects.toThrow();
  });

  it("throws when prototype_creation is missing", async () => {
    const stateNoCreation: State = {
      ...makeState(),
      phases: {
        ...makeState().phases,
        prototype: {
          ...makeState().phases.prototype,
          prototype_creation: undefined,
        },
      },
    };

    await expect(
      runAuditPrototype(
        { provider: "claude", force: false },
        {
          invokeAgentFn: fakeInvoke,
          readStateFn: async () => stateNoCreation,
          loadSkillFn: fakeLoadSkill,
          writeStateFn: async () => {},
        },
      ),
    ).rejects.toThrow();
  });

  it("throws when prototype_creation.status is 'pending'", async () => {
    const statePending = makeState({
      prototype_creation: { status: "pending", file: null },
    });

    await expect(
      runAuditPrototype(
        { provider: "claude", force: false },
        {
          invokeAgentFn: fakeInvoke,
          readStateFn: async () => statePending,
          loadSkillFn: fakeLoadSkill,
          writeStateFn: async () => {},
        },
      ),
    ).rejects.toThrow();
  });

  it("succeeds (auditAllowed=true) when prototype_creation.status is 'completed'", async () => {
    await expect(
      runAuditPrototype(
        { provider: "claude" },
        {
          existsFn: fakeExistsFn,
          invokeAgentFn: fakeInvoke,
          readStateFn: async () => makeState(),
          loadSkillFn: fakeLoadSkill,
          writeStateFn: async () => {},
        },
      ),
    ).resolves.toBeUndefined();
  });

  it("does NOT call writeStateFn when agent invocation fails", async () => {
    let writeStateCalled = false;
    const failingInvoke = async () => ({ exitCode: 1, stdout: "", stderr: "" });

    await expect(
      runAuditPrototype(
        { provider: "claude" },
        {
          invokeAgentFn: failingInvoke,
          readStateFn: async () => makeState(),
          loadSkillFn: fakeLoadSkill,
          writeStateFn: async () => {
            writeStateCalled = true;
          },
        },
      ),
    ).rejects.toThrow();

    expect(writeStateCalled).toBe(false);
  });
});
