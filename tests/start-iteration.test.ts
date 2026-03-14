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

  it("increments current_iteration and archives previous flow artifacts", async () => {
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
    const filesToArchive = ["product-requirement-document.md", "progress.json"].map(
      (name) => `${iterPrefix}${name}`,
    );

    for (const file of filesToArchive) {
      await writeFile(join(flowDir, file), "content", "utf8");
    }

    const otherFile = join(flowDir, "unrelated.txt");
    await writeFile(otherFile, "keep", "utf8");

    await runStartIteration();

    const updatedState = await readState(projectRoot);
    expect(updatedState.current_iteration).toBe("000002");

    const archivedDir = join(projectRoot, FLOW_REL_DIR, "archived", "000001");

    const archivedEntries = await readdir(archivedDir);
    expect(archivedEntries.sort()).toEqual(filesToArchive.sort());

    const flowEntries = await readdir(flowDir);
    expect(flowEntries).toContain("unrelated.txt");
    for (const file of filesToArchive) {
      await expect(stat(join(flowDir, file))).rejects.toThrow();
    }

    await rm(projectRoot, { recursive: true, force: true });
  });
});

