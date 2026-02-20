import { access, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { StateSchema } from "../../scaffold/schemas/tmpl_state";

const STATE_PATH = join(".agents", "state.json");
const FLOW_DIR = join(".agents", "flow");
const ARCHIVED_DIR = join(FLOW_DIR, "archived");

type IterationState = {
  current_iteration: string;
  current_phase: "define";
  phases: {
    define: {
      requirement_definition: { status: "pending"; file: null };
      prd_generation: { status: "pending"; file: null };
    };
    prototype: {
      project_context: { status: "pending"; file: null };
      test_plan: { status: "pending"; file: null };
      tp_generation: { status: "pending"; file: null };
      prototype_build: { status: "pending"; file: null };
      prototype_approved: false;
    };
    refactor: {
      evaluation_report: { status: "pending"; file: null };
      refactor_plan: { status: "pending"; file: null };
      refactor_execution: { status: "pending"; file: null };
      changelog: { status: "pending"; file: null };
    };
  };
  last_updated: string;
  history: Array<{
    iteration: string;
    archived_at: string;
    archived_path: string;
  }>;
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function createInitialState(nowIso: string): IterationState {
  return {
    current_iteration: "000001",
    current_phase: "define",
    phases: {
      define: {
        requirement_definition: { status: "pending", file: null },
        prd_generation: { status: "pending", file: null },
      },
      prototype: {
        project_context: { status: "pending", file: null },
        test_plan: { status: "pending", file: null },
        tp_generation: { status: "pending", file: null },
        prototype_build: { status: "pending", file: null },
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
    history: [],
  };
}

function nextIteration(iteration: string): string {
  return String(Number.parseInt(iteration, 10) + 1).padStart(6, "0");
}

export async function runStartIteration(): Promise<void> {
  const projectRoot = process.cwd();
  const statePath = join(projectRoot, STATE_PATH);
  const flowDir = join(projectRoot, FLOW_DIR);
  const nowIso = new Date().toISOString();

  await mkdir(flowDir, { recursive: true });

  if (!(await exists(statePath))) {
    const initialState = createInitialState(nowIso);
    await writeFile(statePath, `${JSON.stringify(initialState, null, 2)}\n`, "utf8");
    console.log("Iteration 000001 started (phase: define)");
    return;
  }

  const rawState = await readFile(statePath, "utf8");
  const parsedState = StateSchema.parse(JSON.parse(rawState));

  const currentIteration = parsedState.current_iteration;
  const flowEntries = await readdir(flowDir, { withFileTypes: true });
  const filePrefix = `it_${currentIteration}_`;
  const filesToArchive = flowEntries
    .filter((entry) => entry.isFile() && entry.name.startsWith(filePrefix))
    .map((entry) => entry.name);

  const iterationArchiveDir = join(ARCHIVED_DIR, currentIteration);
  const iterationArchiveAbsDir = join(projectRoot, iterationArchiveDir);
  await mkdir(iterationArchiveAbsDir, { recursive: true });

  for (const fileName of filesToArchive) {
    await rename(join(flowDir, fileName), join(iterationArchiveAbsDir, fileName));
  }

  const updatedHistory = [
    ...(parsedState.history ?? []),
    {
      iteration: currentIteration,
      archived_at: nowIso,
      archived_path: `.agents/flow/archived/${currentIteration}`,
    },
  ];

  const nextState = createInitialState(nowIso);
  nextState.current_iteration = nextIteration(currentIteration);
  nextState.history = updatedHistory;

  await writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");

  console.log(
    `Archived ${filesToArchive.length} file(s) to .agents/flow/archived/${currentIteration}`,
  );
  console.log(`Iteration ${nextState.current_iteration} started (phase: define)`);
}
