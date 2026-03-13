import { describe, expect, it } from "bun:test";

import { GuardrailAbortError, assertGuardrail } from "../src/guardrail";
import type { State } from "../scaffold/schemas/tmpl_state";

function createState(overrides: Partial<State> = {}): State {
  const base: State = {
    current_iteration: "000001",
    current_phase: "define",
    phases: {
      define: {
        requirement_definition: {
          status: "pending",
          file: null,
        },
        prd_generation: {
          status: "pending",
          file: null,
        },
      },
      prototype: {},
      refactor: {},
    },
    last_updated: "2024-01-01T00:00:00.000Z",
  } as State;

  return {
    ...base,
    ...overrides,
  } as State;
}

describe("assertGuardrail", () => {
  it("returns without side effects when not violated (all modes)", async () => {
    const originalExitCode = process.exitCode;
    const stderrMessages: string[] = [];
    const stderrWriteFn = (msg: string) => {
      stderrMessages.push(msg);
    };

    const stateStrict = createState({ flow_guardrail: "strict" });
    const stateRelaxed = createState({ flow_guardrail: "relaxed" });
    const stateDefault = createState({});

    await assertGuardrail(stateStrict, false, "should not matter", {
      stderrWriteFn,
    });
    await assertGuardrail(stateRelaxed, false, "should not matter", {
      stderrWriteFn,
    });
    await assertGuardrail(stateDefault, false, "should not matter", {
      stderrWriteFn,
    });

    expect(stderrMessages).toHaveLength(0);
    expect(process.exitCode).toBe(originalExitCode);
  });

  it("in strict mode without force throws Error with the provided message when violated", async () => {
    const state = createState({ flow_guardrail: "strict" });
    const originalExitCode = process.exitCode;
    const stderrMessages: string[] = [];

    await expect(
      assertGuardrail(state, true, "strict error", {
        stderrWriteFn: (msg) => stderrMessages.push(msg),
      }),
    ).rejects.toThrow("strict error");

    expect(stderrMessages).toHaveLength(0);
    expect(process.exitCode).toBe(originalExitCode);
  });

  it("in strict mode with force returns without throwing when violated", async () => {
    const state = createState({ flow_guardrail: "strict" });
    const originalExitCode = process.exitCode;
    const stderrMessages: string[] = [];

    await expect(
      assertGuardrail(state, true, "strict forced", {
        force: true,
        stderrWriteFn: (msg) => stderrMessages.push(msg),
      }),
    ).resolves.toBeUndefined();

    expect(stderrMessages[0]).toBe("Warning: strict forced");
    expect(stderrMessages).toHaveLength(1);
    expect(process.exitCode).toBe(originalExitCode);
  });

  it('in relaxed mode without force throws GuardrailAbortError when user inputs anything other than "y" or "Y"', async () => {
    const state = createState({ flow_guardrail: "relaxed" });
    const stderrMessages: string[] = [];
    const originalExitCode = process.exitCode;

    const readLineFn = async () => "n";

    await expect(
      assertGuardrail(state, true, "relaxed aborted", {
        readLineFn,
        stderrWriteFn: (msg) => stderrMessages.push(msg),
      }),
    ).rejects.toBeInstanceOf(GuardrailAbortError);

    expect(stderrMessages).toEqual([
      "Warning: relaxed aborted",
      "Proceed anyway? [y/N]",
      "Aborted.",
    ]);
    expect(process.exitCode).toBe(1);

    process.exitCode = originalExitCode;
  });

  it('in relaxed mode without force returns when user inputs "y"', async () => {
    const state = createState({ flow_guardrail: "relaxed" });
    const stderrMessages: string[] = [];
    const originalExitCode = process.exitCode;

    const readLineFn = async () => "y";

    await expect(
      assertGuardrail(state, true, "relaxed confirmed", {
        readLineFn,
        stderrWriteFn: (msg) => stderrMessages.push(msg),
      }),
    ).resolves.toBeUndefined();

    expect(stderrMessages).toEqual([
      "Warning: relaxed confirmed",
      "Proceed anyway? [y/N]",
    ]);
    expect(process.exitCode).toBe(originalExitCode);
  });

  it('in relaxed mode without force returns when user inputs "Y"', async () => {
    const state = createState({ flow_guardrail: "relaxed" });
    const stderrMessages: string[] = [];
    const originalExitCode = process.exitCode;

    const readLineFn = async () => "Y";

    await expect(
      assertGuardrail(state, true, "relaxed confirmed upper", {
        readLineFn,
        stderrWriteFn: (msg) => stderrMessages.push(msg),
      }),
    ).resolves.toBeUndefined();

    expect(stderrMessages).toEqual([
      "Warning: relaxed confirmed upper",
      "Proceed anyway? [y/N]",
    ]);
    expect(process.exitCode).toBe(originalExitCode);
  });

  it("in relaxed mode with force writes warning and returns without prompting or throwing", async () => {
    const state = createState({ flow_guardrail: "relaxed" });
    const stderrMessages: string[] = [];
    let readCalled = false;

    const readLineFn = async () => {
      readCalled = true;
      return "y";
    };

    await expect(
      assertGuardrail(state, true, "relaxed forced", {
        force: true,
        readLineFn,
        stderrWriteFn: (msg) => stderrMessages.push(msg),
      }),
    ).resolves.toBeUndefined();

    expect(stderrMessages).toEqual(["Warning: relaxed forced"]);
    expect(readCalled).toBe(false);
  });
});

