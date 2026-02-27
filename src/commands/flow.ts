import type { AgentProvider } from "../agent";
import { parseProvider } from "../agent";
import { runCreateProjectContext } from "./create-project-context";
import { runCreatePrototype } from "./create-prototype";
import { runCreateTestPlan } from "./create-test-plan";
import { runDefineRefactorPlan } from "./define-refactor-plan";
import { runDefineRequirement } from "./define-requirement";
import { runExecuteRefactor } from "./execute-refactor";
import { runExecuteTestPlan } from "./execute-test-plan";
import { defaultReadLine } from "../readline";
import { readState } from "../state";
import type { State } from "../../scaffold/schemas/tmpl_state";

export interface FlowOptions {
  provider?: AgentProvider;
  force?: boolean;
}

type FlowStepId =
  | "define-requirement"
  | "create-project-context"
  | "create-prototype"
  | "create-test-plan"
  | "execute-test-plan"
  | "define-refactor-plan"
  | "execute-refactor";

interface FlowStep {
  id: FlowStepId;
  label: string;
  requiresAgent: boolean;
}

type FlowDecision =
  | { kind: "step"; step: FlowStep }
  | { kind: "approval_gate"; message: string }
  | { kind: "complete"; message: string }
  | { kind: "blocked"; message: string };

function approvalGateMessage(step: string): string {
  return `Waiting for approval. Run: nvst approve ${step} to continue, then re-run nvst flow.`;
}

interface FlowDeps {
  readLineFn: () => Promise<string | null>;
  readStateFn: (projectRoot: string) => Promise<State>;
  runCreateProjectContextFn: typeof runCreateProjectContext;
  runCreatePrototypeFn: typeof runCreatePrototype;
  runCreateTestPlanFn: typeof runCreateTestPlan;
  runDefineRefactorPlanFn: typeof runDefineRefactorPlan;
  runDefineRequirementFn: typeof runDefineRequirement;
  runExecuteRefactorFn: typeof runExecuteRefactor;
  runExecuteTestPlanFn: typeof runExecuteTestPlan;
  stderrWriteFn: (message: string) => void;
  stdoutWriteFn: (message: string) => void;
}

const defaultDeps: FlowDeps = {
  readLineFn: defaultReadLine,
  readStateFn: readState,
  runCreateProjectContextFn: runCreateProjectContext,
  runCreatePrototypeFn: runCreatePrototype,
  runCreateTestPlanFn: runCreateTestPlan,
  runDefineRefactorPlanFn: runDefineRefactorPlan,
  runDefineRequirementFn: runDefineRequirement,
  runExecuteRefactorFn: runExecuteRefactor,
  runExecuteTestPlanFn: runExecuteTestPlan,
  stderrWriteFn: (message: string) => process.stderr.write(`${message}\n`),
  stdoutWriteFn: (message: string) => process.stdout.write(`${message}\n`),
};

const FLOW_STEPS: Record<FlowStepId, FlowStep> = {
  "define-requirement": {
    id: "define-requirement",
    label: "define requirement",
    requiresAgent: true,
  },
  "create-project-context": {
    id: "create-project-context",
    label: "create project-context",
    requiresAgent: true,
  },
  "create-prototype": {
    id: "create-prototype",
    label: "create prototype",
    requiresAgent: true,
  },
  "create-test-plan": {
    id: "create-test-plan",
    label: "create test-plan",
    requiresAgent: true,
  },
  "execute-test-plan": {
    id: "execute-test-plan",
    label: "execute test-plan",
    requiresAgent: true,
  },
  "define-refactor-plan": {
    id: "define-refactor-plan",
    label: "define refactor-plan",
    requiresAgent: true,
  },
  "execute-refactor": {
    id: "execute-refactor",
    label: "execute refactor",
    requiresAgent: true,
  },
};

function isPendingOrInProgress(status: string): boolean {
  return status === "pending" || status === "in_progress";
}

function buildIterationCompleteMessage(iteration: string): string {
  return `Iteration ${iteration} complete. All phases finished.`;
}

export function detectNextFlowDecision(state: State): FlowDecision {
  const define = state.phases.define;
  const prototype = state.phases.prototype;
  const refactor = state.phases.refactor;

  if (state.current_phase === "refactor" && refactor.refactor_execution.status === "completed") {
    return { kind: "complete", message: buildIterationCompleteMessage(state.current_iteration) };
  }

  if (define.requirement_definition.status === "in_progress") {
    return {
      kind: "approval_gate",
      message: approvalGateMessage("requirement"),
    };
  }
  if (prototype.project_context.status === "pending_approval") {
    return {
      kind: "approval_gate",
      message: approvalGateMessage("project-context"),
    };
  }
  if (prototype.test_plan.status === "pending_approval") {
    return {
      kind: "approval_gate",
      message: approvalGateMessage("test-plan"),
    };
  }
  if (prototype.test_execution.status === "completed" && !prototype.prototype_approved) {
    return {
      kind: "approval_gate",
      message: approvalGateMessage("prototype"),
    };
  }
  if (refactor.refactor_plan.status === "pending_approval") {
    return {
      kind: "approval_gate",
      message: approvalGateMessage("refactor-plan"),
    };
  }

  if (state.current_phase === "define") {
    if (define.requirement_definition.status === "pending") {
      return { kind: "step", step: FLOW_STEPS["define-requirement"] };
    }
    if (define.prd_generation.status === "completed" && prototype.project_context.status === "pending") {
      return { kind: "step", step: FLOW_STEPS["create-project-context"] };
    }
    return {
      kind: "blocked",
      message: "No runnable flow step found in define phase.",
    };
  }

  if (state.current_phase === "prototype") {
    if (prototype.project_context.status === "pending") {
      return { kind: "step", step: FLOW_STEPS["create-project-context"] };
    }
    if (
      prototype.project_context.status === "created"
      && isPendingOrInProgress(prototype.prototype_build.status)
    ) {
      return { kind: "step", step: FLOW_STEPS["create-prototype"] };
    }
    if (prototype.prototype_build.status === "created" && prototype.test_plan.status === "pending") {
      return { kind: "step", step: FLOW_STEPS["create-test-plan"] };
    }
    if (
      prototype.tp_generation.status === "created"
      && (prototype.test_execution.status === "pending"
        || prototype.test_execution.status === "in_progress"
        || prototype.test_execution.status === "failed")
    ) {
      return { kind: "step", step: FLOW_STEPS["execute-test-plan"] };
    }
    if (prototype.prototype_approved && refactor.refactor_plan.status === "pending") {
      return { kind: "step", step: FLOW_STEPS["define-refactor-plan"] };
    }
    return {
      kind: "blocked",
      message: "No runnable flow step found in prototype phase.",
    };
  }

  if (state.current_phase === "refactor") {
    if (refactor.refactor_plan.status === "pending") {
      return { kind: "step", step: FLOW_STEPS["define-refactor-plan"] };
    }
    if (refactor.refactor_plan.status === "approved" && isPendingOrInProgress(refactor.refactor_execution.status)) {
      return { kind: "step", step: FLOW_STEPS["execute-refactor"] };
    }
    if (refactor.refactor_execution.status === "completed") {
      return { kind: "complete", message: buildIterationCompleteMessage(state.current_iteration) };
    }
    return {
      kind: "blocked",
      message: "No runnable flow step found in refactor phase.",
    };
  }

  return {
    kind: "blocked",
    message: `Unsupported current_phase '${state.current_phase}'.`,
  };
}

async function ensureProvider(
  provider: AgentProvider | undefined,
  deps: FlowDeps,
): Promise<AgentProvider> {
  if (provider) {
    return provider;
  }

  deps.stdoutWriteFn("Enter agent provider:");

  const value = await deps.readLineFn();
  if (value === null) {
    throw new Error("Missing agent provider from stdin.");
  }

  return parseProvider(value.trim());
}

export async function runFlow(
  opts: FlowOptions = {},
  deps: Partial<FlowDeps> = {},
): Promise<void> {
  const mergedDeps: FlowDeps = { ...defaultDeps, ...deps };
  const projectRoot = process.cwd();
  let provider = opts.provider;
  const force = opts.force ?? false;

  while (true) {
    const state = await mergedDeps.readStateFn(projectRoot);
    const decision = detectNextFlowDecision(state);

    if (decision.kind === "complete") {
      mergedDeps.stdoutWriteFn(decision.message);
      return;
    }

    if (decision.kind === "approval_gate") {
      mergedDeps.stdoutWriteFn(decision.message);
      return;
    }

    if (decision.kind === "blocked") {
      mergedDeps.stderrWriteFn(decision.message);
      process.exitCode = 1;
      return;
    }

    const { step } = decision;
    try {
      if (step.requiresAgent) {
        provider = await ensureProvider(provider, mergedDeps);
      }

      mergedDeps.stdoutWriteFn(`Running: bun nvst ${step.label}`);

      if (step.id === "define-requirement") {
        await mergedDeps.runDefineRequirementFn({ provider: provider!, force });
        continue;
      }

      if (step.id === "create-project-context") {
        await mergedDeps.runCreateProjectContextFn({ provider: provider!, mode: "strict", force });
        continue;
      }

      if (step.id === "create-prototype") {
        await mergedDeps.runCreatePrototypeFn({ provider: provider!, force });
        continue;
      }

      if (step.id === "create-test-plan") {
        await mergedDeps.runCreateTestPlanFn({ provider: provider!, force });
        continue;
      }

      if (step.id === "execute-test-plan") {
        await mergedDeps.runExecuteTestPlanFn({ provider: provider!, force });
        continue;
      }

      if (step.id === "define-refactor-plan") {
        await mergedDeps.runDefineRefactorPlanFn({ provider: provider!, force });
        continue;
      }

      await mergedDeps.runExecuteRefactorFn({ provider: provider!, force });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      mergedDeps.stderrWriteFn(message);
      process.exitCode = 1;
      return;
    }
  }
}
