import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import { runStartIteration, nextIteration } from "../src/commands/start-iteration";
import { FLOW_REL_DIR, STATE_REL_PATH, readState } from "../src/state";
import type { State } from "../src/schemas/tmpl_state";

async function createTempProjectRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-start-iteration-test-"));
}

async function ensureStateDir(projectRoot: string): Promise<string> {
  const statePath = join(projectRoot, STATE_REL_PATH);
  await mkdir(dirname(statePath), { recursive: true });
  return statePath;
}

function createValidState(overrides: Partial<State> = {}): State {
  const base: State = {
    current_iteration: "000001",
    current_phase: "define",
    phases: {
      define: {
        requirement_definition: {
          status: "pending",
          file: null,
        },
        prd_generation: {
          status: "pending",
          file: null,
        },
      },
      prototype: {},
      refactor: {},
    },
    last_updated: "2024-01-01T00:00:00.000Z",
  };

  return {
    ...base,
    ...overrides,
  } as State;
}

describe("nextIteration", () => {
  it("increments a simple iteration id", () => {
    expect(nextIteration("000001")).toBe("000002");
  });

  it("zero pads correctly when incrementing", () => {
    expect(nextIteration("000009")).toBe("000010");
  });
});

describe("runStartIteration", () => {
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
  });

  it("creates a fresh state with current_iteration 000001 when no prior state exists", async () => {
    const projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);

    await runStartIteration();

    const state = await readState(projectRoot);
    expect(state.current_iteration).toBe("000001");
    expect(state.current_phase).toBe("define");

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("initialises phases.define.ideation as { status: 'pending', file: null } (US-005-AC02)", async () => {
    const projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);

    await runStartIteration();

    const state = await readState(projectRoot);
    expect(state.phases.define.ideation).toEqual({ status: "pending", file: null });

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("parses state without ideation field without error (US-005-AC03)", async () => {
    const projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);

    // State without ideation field (legacy format)
    const stateWithoutIdeation = createValidState({ current_iteration: "000001" });
    const statePath = await ensureStateDir(projectRoot);
    await writeFile(statePath, `${JSON.stringify(stateWithoutIdeation, null, 2)}\n`, "utf8");

    await runStartIteration();

    const updatedState = await readState(projectRoot);
    expect(updatedState.current_iteration).toBe("000002");
    // ideation should be initialised fresh since previous had none
    expect(updatedState.phases.define.ideation).toEqual({ status: "pending", file: null });

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("increments current_iteration and deletes all previous flow artifacts (US-001-AC01)", async () => {
    const projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);

    const state = createValidState({
      current_iteration: "000001",
    });
    const statePath = await ensureStateDir(projectRoot);
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

    const flowDir = join(projectRoot, FLOW_REL_DIR);
    await mkdir(flowDir, { recursive: true });

    const iterPrefix = "it_000001_";
    const filesToDelete = ["product-requirement-document.md", "progress.json"].map(
      (name) => `${iterPrefix}${name}`,
    );

    for (const file of filesToDelete) {
      await writeFile(join(flowDir, file), "content", "utf8");
    }

    await runStartIteration();

    const updatedState = await readState(projectRoot);
    expect(updatedState.current_iteration).toBe("000002");

    const flowEntries = await readdir(flowDir);
    expect(flowEntries).toHaveLength(0);

    for (const file of filesToDelete) {
      await expect(stat(join(flowDir, file))).rejects.toThrow();
    }

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("deletes subdirectories inside .agents/flow/ (US-001-AC02)", async () => {
    const projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);

    const state = createValidState({ current_iteration: "000001" });
    const statePath = await ensureStateDir(projectRoot);
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

    const flowDir = join(projectRoot, FLOW_REL_DIR);
    const subDir = join(flowDir, "archived");
    await mkdir(subDir, { recursive: true });
    await writeFile(join(subDir, "some-file.json"), "{}", "utf8");

    await runStartIteration();

    const flowEntries = await readdir(flowDir);
    expect(flowEntries).toHaveLength(0);

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("flow dir still exists after command runs (US-001-AC03)", async () => {
    const projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);

    const state = createValidState({ current_iteration: "000001" });
    const statePath = await ensureStateDir(projectRoot);
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

    const flowDir = join(projectRoot, FLOW_REL_DIR);
    await mkdir(flowDir, { recursive: true });
    await writeFile(join(flowDir, "it_000001_prd.md"), "content", "utf8");

    await runStartIteration();

    const flowStat = await stat(flowDir);
    expect(flowStat.isDirectory()).toBe(true);

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("runs without error when .agents/flow/ is already empty (US-001-AC05)", async () => {
    const projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);

    const state = createValidState({ current_iteration: "000001" });
    const statePath = await ensureStateDir(projectRoot);
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

    const flowDir = join(projectRoot, FLOW_REL_DIR);
    await mkdir(flowDir, { recursive: true });

    await expect(runStartIteration()).resolves.toBeUndefined();

    const updatedState = await readState(projectRoot);
    expect(updatedState.current_iteration).toBe("000002");

    await rm(projectRoot, { recursive: true, force: true });
  });
});

