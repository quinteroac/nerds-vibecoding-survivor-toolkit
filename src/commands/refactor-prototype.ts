import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentInvokeOptions,
  type AgentProvider,
  type AgentResult,
} from "../agent";
import type { State } from "../../scaffold/schemas/tmpl_state";
import { assertGuardrail } from "../guardrail";
import { readState } from "../state";

export interface RefactorPrototypeOptions {
  provider: AgentProvider;
  force?: boolean;
}

interface RefactorPrototypeDeps {
  logFn: (message: string) => void;
  loadSkillFn: (projectRoot: string, skillName: string) => Promise<string>;
  invokeAgentFn: (options: AgentInvokeOptions) => Promise<AgentResult>;
  readStateFn: (projectRoot: string) => Promise<State>;
}

const defaultDeps: RefactorPrototypeDeps = {
  logFn: console.log,
  loadSkillFn: loadSkill,
  invokeAgentFn: invokeAgent,
  readStateFn: readState,
};

function refactorAllowed(state: State): boolean {
  if (state.current_phase !== "prototype") {
    return false;
  }
  const prototypeAudit = state.phases.prototype.prototype_audit;
  if (!prototypeAudit) {
    return false;
  }
  return prototypeAudit.status !== "pending";
}

export async function runRefactorPrototype(
  opts: RefactorPrototypeOptions,
  deps: Partial<RefactorPrototypeDeps> = {},
): Promise<void> {
  const mergedDeps = { ...defaultDeps, ...deps };
  const projectRoot = process.cwd();
  const state = await mergedDeps.readStateFn(projectRoot);
  const force = opts.force ?? false;

  await assertGuardrail(
    state,
    !refactorAllowed(state),
    "Cannot refactor prototype: audit prototype must be run for this iteration first.",
    { force },
  );

  if (opts.provider !== "ide") {
    mergedDeps.logFn("nvst refactor prototype is not implemented yet.");
    return;
  }

  const skillBody = await mergedDeps.loadSkillFn(projectRoot, "refactor-prototype");
  const prompt = buildPrompt(skillBody, { iteration: state.current_iteration });
  const result = await mergedDeps.invokeAgentFn({
    provider: opts.provider,
    prompt,
    cwd: projectRoot,
    interactive: true,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Agent invocation failed with exit code ${result.exitCode}.`);
  }
}
