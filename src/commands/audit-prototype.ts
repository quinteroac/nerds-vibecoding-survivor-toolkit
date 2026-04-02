import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentInvokeOptions,
  type AgentProvider,
  type AgentResult,
} from "../agent";
import type { State } from "../schemas/tmpl_state";
import { assertGuardrail } from "../guardrail";
import { readState, writeState } from "../state";

export interface AuditPrototypeOptions {
  provider: AgentProvider;
  force?: boolean;
  yolo?: boolean;
  interactive?: boolean;
}

interface AuditPrototypeDeps {
  loadSkillFn: (projectRoot: string, skillName: string) => Promise<string>;
  invokeAgentFn: (options: AgentInvokeOptions) => Promise<AgentResult>;
  readStateFn: (projectRoot: string) => Promise<State>;
  writeStateFn: (projectRoot: string, state: State) => Promise<void>;
}

const defaultDeps: AuditPrototypeDeps = {
  loadSkillFn: loadSkill,
  invokeAgentFn: invokeAgent,
  readStateFn: readState,
  writeStateFn: writeState,
};

function auditAllowed(state: State): boolean {
  if (state.current_phase !== "prototype") {
    return false;
  }
  const prototypeCreation = state.phases.prototype.prototype_creation;
  if (!prototypeCreation) {
    return false;
  }
  return prototypeCreation.status !== "pending";
}

export async function runAuditPrototype(
  opts: AuditPrototypeOptions,
  deps: Partial<AuditPrototypeDeps> = {},
): Promise<void> {
  const mergedDeps = { ...defaultDeps, ...deps };
  const projectRoot = process.cwd();
  const state = await mergedDeps.readStateFn(projectRoot);
  const force = opts.force ?? false;

  await assertGuardrail(
    state,
    !auditAllowed(state),
    "Cannot audit prototype: create prototype must be run for this iteration first (current phase/state does not allow audit).",
    { force },
  );

  const skillBody = await mergedDeps.loadSkillFn(projectRoot, "audit-prototype");
  const prompt = buildPrompt(skillBody, { iteration: state.current_iteration });
  const result = await mergedDeps.invokeAgentFn({
    provider: opts.provider,
    prompt,
    cwd: projectRoot,
    interactive: opts.interactive ?? true,
    yolo: opts.yolo ?? false,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Agent invocation failed with exit code ${result.exitCode}.`);
  }

  state.phases.prototype.prototype_audit = {
    ...state.phases.prototype.prototype_audit,
    status: "completed",
    file: state.phases.prototype.prototype_audit?.file ?? null,
  };
  state.updated_by = "nvst:audit-prototype";
  await mergedDeps.writeStateFn(projectRoot, state);
}
