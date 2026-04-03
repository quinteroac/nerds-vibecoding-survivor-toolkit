import { join } from "node:path";

import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentInvokeOptions,
  type AgentProvider,
  type AgentResult,
} from "../agent";
import type { PrototypeRefactorEntry, State } from "../schemas/tmpl_state";
import { assertGuardrail } from "../guardrail";
import { exists, FLOW_REL_DIR, readState, writeState } from "../state";

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
  writeStateFn: (projectRoot: string, state: State) => Promise<void>;
}

const defaultDeps: RefactorPrototypeDeps = {
  existsFn: exists,
  loadSkillFn: loadSkill,
  invokeAgentFn: invokeAgent,
  readStateFn: readState,
  writeStateFn: writeState,
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

  // Collect audit entries from state (new multi-report format, with legacy fallback).
  const rawAuditEntries = state.phases.prototype.prototype_audit;
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

  // Resolve audit artifact paths, one per entry. Entries without a file fall back to legacy names.
  interface ResolvedAuditEntry {
    index: number;
    auditPath: string;
  }
  const resolvedAuditEntries: ResolvedAuditEntry[] = [];

  for (const entry of auditEntries) {
    if (entry.file) {
      const p = join(projectRoot, FLOW_REL_DIR, entry.file);
      if (await mergedDeps.existsFn(p)) {
        resolvedAuditEntries.push({ index: entry.index, auditPath: p });
        continue;
      }
    }
    // Legacy single-artifact fallback (only applies when no file is tracked in state).
    if (auditEntries.length === 1) {
      const auditJsonPath = join(
        projectRoot,
        FLOW_REL_DIR,
        `it_${state.current_iteration}_audit.json`,
      );
      const auditMdPath = join(
        projectRoot,
        FLOW_REL_DIR,
        `it_${state.current_iteration}_audit.md`,
      );
      if (await mergedDeps.existsFn(auditJsonPath)) {
        resolvedAuditEntries.push({ index: entry.index, auditPath: auditJsonPath });
      } else if (await mergedDeps.existsFn(auditMdPath)) {
        resolvedAuditEntries.push({ index: entry.index, auditPath: auditMdPath });
      }
    }
  }

  if (resolvedAuditEntries.length === 0) {
    const auditJsonFileName = `it_${state.current_iteration}_audit.json`;
    const auditMdFileName = `it_${state.current_iteration}_audit.md`;
    throw new Error(
      `Audit artifact not found: expected either ${join(FLOW_REL_DIR, auditJsonFileName)} or ${join(FLOW_REL_DIR, auditMdFileName)}. Run \`nvst audit prototype\` and choose to refactor first.`,
    );
  }

  const skillBody = await mergedDeps.loadSkillFn(projectRoot, "refactor-prototype");
  const refactorEntries: PrototypeRefactorEntry[] = [];

  for (const { index, auditPath } of resolvedAuditEntries) {
    const paddedIndex = String(index).padStart(3, "0");
    const refactorPlanFileName = `it_${state.current_iteration}_refactor-plan_${paddedIndex}.md`;

    const prompt = buildPrompt(skillBody, {
      iteration: state.current_iteration,
      audit_json_path: auditPath,
      refactor_plan_index: paddedIndex,
      refactor_plan_file: refactorPlanFileName,
    });

    const result = await mergedDeps.invokeAgentFn({
      provider: opts.provider,
      prompt,
      cwd: projectRoot,
      interactive: true,
      yolo: opts.yolo ?? false,
    });

    if (result.exitCode !== 0) {
      throw new Error(
        `Agent invocation failed with exit code ${result.exitCode} for audit entry ${paddedIndex}.`,
      );
    }

    refactorEntries.push({ index, status: "completed", file: refactorPlanFileName });
  }

  state.phases.prototype.prototype_refactor = refactorEntries;
  state.updated_by = "nvst:refactor-prototype";
  await mergedDeps.writeStateFn(projectRoot, state);
}
