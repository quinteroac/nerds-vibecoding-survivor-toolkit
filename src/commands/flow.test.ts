import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { State } from "../../scaffold/schemas/tmpl_state";
import { detectNextFlowDecision, runFlow } from "./flow";

function createBaseState(): State {
  return {
    current_iteration: "000019",
    current_phase: "prototype",
    flow_guardrail: "strict",
    phases: {
      define: {
        requirement_definition: { status: "approved", file: "it_000019_product-requirement-document.md" },
        prd_generation: { status: "completed", file: "it_000019_PRD.json" },
      },
      prototype: {
        project_context: { status: "created", file: ".agents/PROJECT_CONTEXT.md" },
        test_plan: { status: "pending", file: null },
        tp_generation: { status: "pending", file: null },
        prototype_build: { status: "pending", file: null },
        test_execution: { status: "pending", file: null },
        prototype_approved: false,
      },
      refactor: {
        evaluation_report: { status: "pending", file: null },
        refactor_plan: { status: "pending", file: null },
        refactor_execution: { status: "pending", file: null },
        changelog: { status: "pending", file: null },
      },
    },
    last_updated: "2026-02-27T00:00:00.000Z",
  };
}

function withState(base: State, mutate: (state: State) => void): State {
  const cloned = structuredClone(base);
  mutate(cloned);
  return cloned;
}

describe("US-001: flow command", () => {
  let previousExitCode: typeof process.exitCode;

  beforeEach(() => {
    previousExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = previousExitCode ?? 0;
  });

  test("AC01: detectNextFlowDecision identifies next pending step from phase/status", () => {
    const state = createBaseState();
    const decision = detectNextFlowDecision(state);

    expect(decision.kind).toBe("step");
    if (decision.kind === "step") {
      expect(decision.step.id).toBe("create-prototype");
    }
  });

  test("AC02 + AC03: delegates to existing handlers and re-reads state between chained steps", async () => {
    const base = createBaseState();
    const s1 = withState(base, (s) => {
      s.current_phase = "prototype";
      s.phases.prototype.prototype_build.status = "pending";
      s.phases.prototype.test_plan.status = "pending";
    });
    const s2 = withState(base, (s) => {
      s.current_phase = "prototype";
      s.phases.prototype.prototype_build.status = "created";
      s.phases.prototype.test_plan.status = "pending";
    });
    const s3 = withState(base, (s) => {
      s.current_phase = "prototype";
      s.phases.prototype.prototype_build.status = "created";
      s.phases.prototype.test_plan.status = "pending_approval";
      s.phases.prototype.test_plan.file = "it_000019_test-plan.md";
    });

    const reads: State[] = [s1, s2, s3];
    let readCount = 0;
    const called: string[] = [];

    await runFlow(
      { provider: "codex" },
      {
        readStateFn: async () => reads[Math.min(readCount++, reads.length - 1)],
        runCreatePrototypeFn: async () => {
          called.push("create-prototype");
        },
        runCreateTestPlanFn: async () => {
          called.push("create-test-plan");
        },
        runCreateProjectContextFn: async () => {
          called.push("create-project-context");
        },
        runDefineRequirementFn: async () => {
          called.push("define-requirement");
        },
        runExecuteTestPlanFn: async () => {
          called.push("execute-test-plan");
        },
        runDefineRefactorPlanFn: async () => {
          called.push("define-refactor-plan");
        },
        runExecuteRefactorFn: async () => {
          called.push("execute-refactor");
        },
        stdoutWriteFn: () => {},
        stderrWriteFn: () => {},
      },
    );

    expect(called).toEqual(["create-prototype", "create-test-plan"]);
    expect(readCount).toBe(3);
  });

  test("AC04: stops at approval gate and when iteration is complete", async () => {
    const approvalGateState = withState(createBaseState(), (s) => {
      s.current_phase = "prototype";
      s.phases.prototype.test_plan.status = "pending_approval";
      s.phases.prototype.test_plan.file = "it_000019_test-plan.md";
    });

    const completeState = withState(createBaseState(), (s) => {
      s.current_phase = "refactor";
      s.phases.refactor.refactor_plan.status = "approved";
      s.phases.refactor.refactor_execution.status = "completed";
    });

    const logs: string[] = [];
    await runFlow(
      { provider: "codex" },
      {
        readStateFn: async () => approvalGateState,
        stdoutWriteFn: (message) => logs.push(message),
        stderrWriteFn: () => {},
      },
    );
    expect(logs.some((line) => line.includes("Approval required"))).toBe(true);

    logs.length = 0;
    await runFlow(
      { provider: "codex" },
      {
        readStateFn: async () => completeState,
        stdoutWriteFn: (message) => logs.push(message),
        stderrWriteFn: () => {},
      },
    );
    expect(logs).toContain("Iteration is complete.");
  });

  test("AC05: prompts for provider from stdin when --agent is not provided", async () => {
    const base = createBaseState();
    const s1 = withState(base, (s) => {
      s.current_phase = "define";
      s.phases.define.requirement_definition.status = "pending";
      s.phases.define.prd_generation.status = "pending";
    });
    const s2 = withState(base, (s) => {
      s.current_phase = "define";
      s.phases.define.requirement_definition.status = "in_progress";
      s.phases.define.prd_generation.status = "pending";
    });

    const reads: State[] = [s1, s2];
    let readCount = 0;
    let delegatedProvider = "";
    const out: string[] = [];

    await runFlow(
      {},
      {
        readStateFn: async () => reads[Math.min(readCount++, reads.length - 1)],
        readLineFn: async () => "codex",
        runDefineRequirementFn: async (opts) => {
          delegatedProvider = opts.provider;
        },
        stdoutWriteFn: (message) => out.push(message),
        stderrWriteFn: () => {},
      },
    );

    expect(out).toContain("Enter agent provider:");
    expect(delegatedProvider).toBe("codex");
  });

  test("AC06: passes --force through to delegated handlers (guardrail behavior parity)", async () => {
    const base = createBaseState();
    const s1 = withState(base, (s) => {
      s.current_phase = "prototype";
      s.phases.prototype.prototype_build.status = "pending";
    });
    const s2 = withState(base, (s) => {
      s.current_phase = "prototype";
      s.phases.prototype.test_plan.status = "pending_approval";
    });

    const reads: State[] = [s1, s2];
    let readCount = 0;
    let receivedForce = false;

    await runFlow(
      { provider: "codex", force: true },
      {
        readStateFn: async () => reads[Math.min(readCount++, reads.length - 1)],
        runCreatePrototypeFn: async (opts) => {
          receivedForce = opts.force ?? false;
        },
        stdoutWriteFn: () => {},
        stderrWriteFn: () => {},
      },
    );

    expect(receivedForce).toBe(true);
  });

  test("AC07: stops immediately on delegated command error, writes to stderr, and sets non-zero exit", async () => {
    const base = createBaseState();
    const s1 = withState(base, (s) => {
      s.current_phase = "prototype";
      s.phases.prototype.prototype_build.status = "pending";
    });
    const s2 = withState(base, (s) => {
      s.current_phase = "prototype";
      s.phases.prototype.prototype_build.status = "created";
      s.phases.prototype.test_plan.status = "pending";
    });

    const reads: State[] = [s1, s2];
    let readCount = 0;
    let nextCalled = false;
    const errors: string[] = [];

    await runFlow(
      { provider: "codex" },
      {
        readStateFn: async () => reads[Math.min(readCount++, reads.length - 1)],
        runCreatePrototypeFn: async () => {
          throw new Error("boom");
        },
        runCreateTestPlanFn: async () => {
          nextCalled = true;
        },
        stdoutWriteFn: () => {},
        stderrWriteFn: (message) => errors.push(message),
      },
    );

    expect(nextCalled).toBe(false);
    expect(errors).toContain("boom");
    expect(process.exitCode).toBe(1);
  });

  test("AC08: treats in_progress step as pending and re-executes it", async () => {
    const base = createBaseState();
    const s1 = withState(base, (s) => {
      s.current_phase = "prototype";
      s.phases.prototype.prototype_build.status = "in_progress";
      s.phases.prototype.project_context.status = "created";
    });
    const s2 = withState(base, (s) => {
      s.current_phase = "prototype";
      s.phases.prototype.test_plan.status = "pending_approval";
      s.phases.prototype.project_context.status = "created";
      s.phases.prototype.prototype_build.status = "created";
    });

    const reads: State[] = [s1, s2];
    let readCount = 0;
    let rerunCount = 0;

    await runFlow(
      { provider: "codex" },
      {
        readStateFn: async () => reads[Math.min(readCount++, reads.length - 1)],
        runCreatePrototypeFn: async () => {
          rerunCount += 1;
        },
        stdoutWriteFn: () => {},
        stderrWriteFn: () => {},
      },
    );

    expect(rerunCount).toBe(1);
  });

  test("AC09: delegated handlers used by flow do not call process.exit()", async () => {
    const commandFiles = [
      "define-requirement.ts",
      "create-project-context.ts",
      "create-prototype.ts",
      "create-test-plan.ts",
      "execute-test-plan.ts",
      "define-refactor-plan.ts",
      "execute-refactor.ts",
    ];

    for (const fileName of commandFiles) {
      const source = await readFile(join(import.meta.dir, fileName), "utf8");
      expect(source).not.toContain("process.exit(");
    }
  });
});
