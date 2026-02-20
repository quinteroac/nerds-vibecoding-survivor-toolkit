import { join } from "node:path";

import { exists, readState, writeState, FLOW_REL_DIR } from "../state";

export async function runApproveRequirement(): Promise<void> {
  const projectRoot = process.cwd();
  const state = await readState(projectRoot);

  const requirementDefinition = state.phases.define.requirement_definition;
  if (requirementDefinition.status !== "in_progress") {
    throw new Error(
      `Cannot approve requirement from status '${requirementDefinition.status}'. Expected in_progress.`,
    );
  }

  const requirementFile = requirementDefinition.file;
  if (!requirementFile) {
    throw new Error("Cannot approve requirement: define.requirement_definition.file is missing.");
  }

  const requirementPath = join(projectRoot, FLOW_REL_DIR, requirementFile);
  if (!(await exists(requirementPath))) {
    throw new Error(`Cannot approve requirement: file not found at ${requirementPath}`);
  }

  requirementDefinition.status = "approved";
  state.last_updated = new Date().toISOString();
  state.updated_by = "nvst:approve-requirement";

  await writeState(projectRoot, state);

  console.log("Requirement approved.");
}
