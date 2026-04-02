import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import type { State } from "../schemas/tmpl_state";
import { exists, readState, writeState, STATE_REL_PATH, FLOW_REL_DIR } from "../state";

function createInitialState(nowIso: string): State {
  return {
    current_iteration: "000001",
    current_phase: "define",
    phases: {
      define: {
        ideation: { status: "pending", file: null },
        requirement_definition: { status: "pending", file: null },
        prd_generation: { status: "pending", file: null },
      },
      prototype: {
        prototype_creation: { status: "pending", file: null },
        prototype_audit: { status: "pending", file: null },
        prototype_refactor: { status: "pending", file: null },
        prototype_approval: { status: "pending", file: null },
        project_context: { status: "pending", file: null },
        test_plan: { status: "pending", file: null },
        tp_generation: { status: "pending", file: null },
        prototype_build: { status: "pending", file: null },
        test_execution: { status: "pending", file: null },
        prototype_approved: false,
      },
      refactor: {
        evaluation_report: { status: "pending", file: null },
        refactor_plan: { status: "pending", file: null },
        refactor_execution: { status: "pending", file: null },
        changelog: { status: "pending", file: null },
      },
    },
    last_updated: nowIso,
  };
}

export function nextIteration(iteration: string): string {
  return String(Number.parseInt(iteration, 10) + 1).padStart(6, "0");
}

export async function runStartIteration(): Promise<void> {
  const projectRoot = process.cwd();
  const statePath = join(projectRoot, STATE_REL_PATH);
  const flowDir = join(projectRoot, FLOW_REL_DIR);
  const nowIso = new Date().toISOString();

  await mkdir(flowDir, { recursive: true });

  if (!(await exists(statePath))) {
    await writeState(projectRoot, createInitialState(nowIso));
    console.log("Iteration 000001 started (phase: define)");
    return;
  }

  const parsedState = await readState(projectRoot);

  const currentIteration = parsedState.current_iteration;
  const flowEntries = await readdir(flowDir, { withFileTypes: true });

  for (const entry of flowEntries) {
    await rm(join(flowDir, entry.name), { recursive: true, force: true });
  }

  const nextState = createInitialState(nowIso);
  nextState.current_iteration = nextIteration(currentIteration);

  // Preserve project_context when already created (immutable across iterations)
  const prevProjectContext = parsedState.phases?.prototype?.project_context;
  if (prevProjectContext?.status === "created" && prevProjectContext?.file) {
    nextState.phases.prototype.project_context = {
      status: "created",
      file: prevProjectContext.file,
    };
  }

  // Preserve flow_guardrail so user configuration is not lost when starting an iteration
  if (parsedState.flow_guardrail !== undefined) {
    nextState.flow_guardrail = parsedState.flow_guardrail;
  }

  await writeState(projectRoot, nextState);

  console.log(`Deleted ${flowEntries.length} file(s) from .agents/flow/`);
  console.log(`Iteration ${nextState.current_iteration} started (phase: define)`);
}
