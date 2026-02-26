import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentInvokeOptions,
  type AgentProvider,
  type AgentResult,
} from "../agent";
import { readState, writeState } from "../state";

export interface DefineRefactorPlanOptions {
  provider: AgentProvider;
}

interface DefineRefactorPlanDeps {
  invokeAgentFn: (options: AgentInvokeOptions) => Promise<AgentResult>;
  loadSkillFn: (projectRoot: string, skillName: string) => Promise<string>;
  nowFn: () => Date;
}

const defaultDeps: DefineRefactorPlanDeps = {
  invokeAgentFn: invokeAgent,
  loadSkillFn: loadSkill,
  nowFn: () => new Date(),
};

export async function runDefineRefactorPlan(
  opts: DefineRefactorPlanOptions,
  deps: Partial<DefineRefactorPlanDeps> = {},
): Promise<void> {
  const { provider } = opts;
  const projectRoot = process.cwd();
  const state = await readState(projectRoot);
  const mergedDeps: DefineRefactorPlanDeps = { ...defaultDeps, ...deps };

  if (state.current_phase !== "refactor") {
    throw new Error("Cannot define refactor plan: current_phase must be 'refactor'.");
  }

  const refactorPlan = state.phases.refactor.refactor_plan;
  if (refactorPlan.status !== "pending") {
    throw new Error(
      `Cannot define refactor plan from status '${refactorPlan.status}'. Expected pending.`,
    );
  }

  const skillBody = await mergedDeps.loadSkillFn(projectRoot, "plan-refactor");
  const prompt = buildPrompt(skillBody, {
    current_iteration: state.current_iteration,
  });
  const result = await mergedDeps.invokeAgentFn({
    provider,
    prompt,
    cwd: projectRoot,
    interactive: true,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Agent invocation failed with exit code ${result.exitCode}.`);
  }

  refactorPlan.status = "pending_approval";
  refactorPlan.file = `it_${state.current_iteration}_refactor-plan.md`;
  state.last_updated = mergedDeps.nowFn().toISOString();
  state.updated_by = "nvst:define-refactor-plan";

  await writeState(projectRoot, state);

  console.log("Refactor plan definition completed and marked as pending approval.");
}
