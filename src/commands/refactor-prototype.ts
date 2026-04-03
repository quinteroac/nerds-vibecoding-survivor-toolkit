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
import { exists, FLOW_REL_DIR, readState } from "../state";

export interface RefactorPrototypeOptions {
  provider: AgentProvider;
  force?: boolean;
  yolo?: boolean;
}

interface RefactorPrototypeDeps {
  existsFn: (path: string) => Promise<boolean>;
  loadSkillFn: (projectRoot: string, skillName: string) => Promise<string>;
  invokeAgentFn: (options: AgentInvokeOptions) => Promise<AgentResult>;
  readStateFn: (projectRoot: string) => Promise<State>;
}

const defaultDeps: RefactorPrototypeDeps = {
  existsFn: exists,
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
  // Support both array (new) and legacy single-object formats (tests that bypass readState).
  if (Array.isArray(prototypeAudit)) {
    if (prototypeAudit.length === 0) return false;
    return prototypeAudit.every((e) => e.status !== "pending");
  }
  return (prototypeAudit as unknown as { status: string }).status !== "pending";
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

  // Collect audit artifact paths from state entries (new multi-report format).
  const rawAuditEntries = state.phases.prototype.prototype_audit;
  // Support legacy single-object format for state objects injected directly in tests.
  const auditEntries = Array.isArray(rawAuditEntries)
    ? rawAuditEntries
    : rawAuditEntries
      ? [
          {
            index: 1,
            status: (rawAuditEntries as unknown as { status: string }).status,
            file: (rawAuditEntries as unknown as { file: string | null }).file ?? null,
          },
        ]
      : [];
  const auditPaths: string[] = [];
  for (const entry of auditEntries) {
    if (entry.file) {
      const p = join(projectRoot, FLOW_REL_DIR, entry.file);
      if (await mergedDeps.existsFn(p)) {
        auditPaths.push(p);
      }
    }
  }

  // Fall back to legacy single-artifact naming when no entry files are resolved.
  if (auditPaths.length === 0) {
    const auditJsonFileName = `it_${state.current_iteration}_audit.json`;
    const auditJsonPath = join(projectRoot, FLOW_REL_DIR, auditJsonFileName);
    const auditMdFileName = `it_${state.current_iteration}_audit.md`;
    const auditMdPath = join(projectRoot, FLOW_REL_DIR, auditMdFileName);

    if (await mergedDeps.existsFn(auditJsonPath)) {
      auditPaths.push(auditJsonPath);
    } else if (await mergedDeps.existsFn(auditMdPath)) {
      auditPaths.push(auditMdPath);
    }
  }

  if (auditPaths.length === 0) {
    const auditJsonFileName = `it_${state.current_iteration}_audit.json`;
    const auditMdFileName = `it_${state.current_iteration}_audit.md`;
    throw new Error(
      `Audit artifact not found: expected either ${join(FLOW_REL_DIR, auditJsonFileName)} or ${join(FLOW_REL_DIR, auditMdFileName)}. Run \`nvst audit prototype\` and choose to refactor first.`,
    );
  }

  const auditPlanPath = auditPaths[0];
  const skillBody = await mergedDeps.loadSkillFn(projectRoot, "refactor-prototype");
  const prompt = buildPrompt(skillBody, {
    iteration: state.current_iteration,
    audit_json_path: auditPlanPath,
  });
  const result = await mergedDeps.invokeAgentFn({
    provider: opts.provider,
    prompt,
    cwd: projectRoot,
    interactive: true,
    yolo: opts.yolo ?? false,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Agent invocation failed with exit code ${result.exitCode}.`);
  }
}
