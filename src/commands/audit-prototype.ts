import { join } from "node:path";

import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentInvokeOptions,
  type AgentProvider,
  type AgentResult,
} from "../agent";
import type { PrototypeAuditEntry, State } from "../schemas/tmpl_state";
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

  const rawRequirementDefs = state.phases.define.requirement_definition;
  // Support legacy single-object format for state objects injected directly in tests.
  const requirementDefs = Array.isArray(rawRequirementDefs)
    ? rawRequirementDefs
    : [
        {
          index: 1,
          status: (rawRequirementDefs as unknown as { status: string }).status,
          file: (rawRequirementDefs as unknown as { file: string | null }).file ?? null,
        },
      ];
  const prdEntries = [...requirementDefs].sort((a, b) => a.index - b.index);

  if (prdEntries.length === 0) {
    throw new Error(
      "No requirement definitions found. Run `nvst define requirement` and `nvst approve requirement` first.",
    );
  }

  const auditEntries: PrototypeAuditEntry[] = [];

  for (const prdEntry of prdEntries) {
    const paddedIndex = String(prdEntry.index).padStart(3, "0");
    const auditReportFileName = `it_${state.current_iteration}_audit-report_${paddedIndex}.json`;
    const auditReportPath = join(projectRoot, FLOW_REL_DIR, auditReportFileName);

    const autoModeNote = nonInteractive
      ? `\n\n## Auto Mode Directive\nThis execution is non-interactive (auto mode). This audit targets PRD index ${paddedIndex}${prdEntry.file ? ` (file: ${prdEntry.file})` : ""}. Do not ask the user to choose options after the compliance report. Assume option (a) Follow recommendations and proceed immediately. You must write .agents/flow/${auditReportFileName} in this run.`
      : "";

    const prompt = buildPrompt(`${skillBody}${autoModeNote}`, {
      iteration: state.current_iteration,
      prd_index: paddedIndex,
      prd_file: prdEntry.file ?? "",
    });

    const result = await mergedDeps.invokeAgentFn({
      provider: opts.provider,
      prompt,
      cwd: projectRoot,
      interactive: opts.interactive ?? true,
      yolo: opts.yolo ?? false,
    });

    if (result.exitCode !== 0) {
      throw new Error(
        `Agent invocation failed with exit code ${result.exitCode} for PRD ${paddedIndex}.`,
      );
    }

    if (!(await mergedDeps.existsFn(auditReportPath))) {
      throw new Error(
        `Audit report not found after audit step: expected ${join(FLOW_REL_DIR, auditReportFileName)}.`,
      );
    }

    auditEntries.push({ index: prdEntry.index, status: "completed", file: auditReportFileName });
  }

  state.phases.prototype.prototype_audit = auditEntries;
  state.updated_by = "nvst:audit-prototype";
  await mergedDeps.writeStateFn(projectRoot, state);
}
