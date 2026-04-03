import { join } from "node:path";

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
import { exists, FLOW_REL_DIR, readState, writeState } from "../state";

export interface AuditPrototypeOptions {
  provider: AgentProvider;
  force?: boolean;
  yolo?: boolean;
  interactive?: boolean;
}

interface AuditPrototypeDeps {
  existsFn: (path: string) => Promise<boolean>;
  loadSkillFn: (projectRoot: string, skillName: string) => Promise<string>;
  invokeAgentFn: (options: AgentInvokeOptions) => Promise<AgentResult>;
  readStateFn: (projectRoot: string) => Promise<State>;
  writeStateFn: (projectRoot: string, state: State) => Promise<void>;
}

const defaultDeps: AuditPrototypeDeps = {
  existsFn: exists,
  loadSkillFn: loadSkill,
  invokeAgentFn: invokeAgent,
  readStateFn: readState,
  writeStateFn: writeState,
};

function auditAllowed(state: State): boolean {
  if (state.current_phase !== "prototype") {
    return false;
  }
  const creation = state.phases.prototype.prototype_creation;
  if (!creation) {
    return false;
  }
  // Support both the new array format and legacy injected objects (tests that bypass readState).
  if (Array.isArray(creation)) {
    return creation.length > 0 && creation.every((e) => e.status !== "pending");
  }
  // Legacy single-object format (only reachable when state is injected directly in tests).
  return (creation as unknown as { status: string }).status !== "pending";
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
  const nonInteractive = opts.interactive === false;
  const skillWithModeDirective = nonInteractive
    ? `${skillBody}\n\n## Auto Mode Directive\nThis execution is non-interactive (auto mode). Do not ask the user to choose options after the compliance report. Assume option (a) Follow recommendations and proceed immediately. You must write both .agents/flow/it_{iteration}_audit.md and .agents/flow/it_{iteration}_audit.json in this run.`
    : skillBody;
  const prompt = buildPrompt(skillWithModeDirective, { iteration: state.current_iteration });
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

  const auditJsonFileName = `it_${state.current_iteration}_audit.json`;
  const auditJsonPath = join(projectRoot, FLOW_REL_DIR, auditJsonFileName);
  const auditMdFileName = `it_${state.current_iteration}_audit.md`;
  const auditMdPath = join(projectRoot, FLOW_REL_DIR, auditMdFileName);

  let auditArtifactFile: string | null = null;
  if (await mergedDeps.existsFn(auditJsonPath)) {
    auditArtifactFile = auditJsonFileName;
  } else if (await mergedDeps.existsFn(auditMdPath)) {
    auditArtifactFile = auditMdFileName;
  }

  if (!auditArtifactFile) {
    throw new Error(
      `Audit artifact not found after audit step: expected either ${join(FLOW_REL_DIR, auditJsonFileName)} or ${join(FLOW_REL_DIR, auditMdFileName)}.`,
    );
  }

  state.phases.prototype.prototype_audit = {
    ...state.phases.prototype.prototype_audit,
    status: "completed",
    file: auditArtifactFile,
  };
  state.updated_by = "nvst:audit-prototype";
  await mergedDeps.writeStateFn(projectRoot, state);
}
