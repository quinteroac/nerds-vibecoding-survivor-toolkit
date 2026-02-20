import { buildPrompt, invokeAgent, loadSkill, type AgentProvider } from "../agent";
import { readState, writeState } from "../state";

export interface DefineRequirementOptions {
  provider: AgentProvider;
}

export async function runDefineRequirement(opts: DefineRequirementOptions): Promise<void> {
  const { provider } = opts;
  const projectRoot = process.cwd();
  const state = await readState(projectRoot);

  if (state.current_phase !== "define") {
    throw new Error("Cannot define requirement: current_phase must be 'define'.");
  }

  const requirementDefinition = state.phases.define.requirement_definition;
  if (requirementDefinition.status !== "pending") {
    throw new Error(
      `Cannot define requirement from status '${requirementDefinition.status}'. Expected pending.`,
    );
  }

  const skillBody = await loadSkill(projectRoot, "create-pr-document");
  const prompt = buildPrompt(skillBody, {
    current_iteration: state.current_iteration,
  });
  const result = await invokeAgent({
    provider,
    prompt,
    cwd: projectRoot,
    interactive: true,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Agent invocation failed with exit code ${result.exitCode}.`);
  }

  requirementDefinition.status = "in_progress";
  requirementDefinition.file = `it_${state.current_iteration}_product-requirement-document.md`;
  state.last_updated = new Date().toISOString();
  state.updated_by = "nvst:define-requirement";

  await writeState(projectRoot, state);

  console.log("Requirement definition started and marked as in progress.");
}
