import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { STATE_REL_PATH, exists, readState, writeState } from "../src/state";
import type { State } from "../src/schemas/tmpl_state";

async function createTempProjectRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-state-test-"));
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

describe("exists", () => {
  it("returns true for an existing file and false for a non-existent path", async () => {
    const projectRoot = await createTempProjectRoot();
    const existingFile = join(projectRoot, "file.txt");

    await mkdir(dirname(existingFile), { recursive: true });
    await writeFile(existingFile, "content", "utf8");

    expect(await exists(existingFile)).toBe(true);
    expect(await exists(join(projectRoot, "missing.txt"))).toBe(false);

    await rm(projectRoot, { recursive: true, force: true });
  });
});

describe("readState", () => {
  it("returns a valid State object when state.json is present and valid", async () => {
    const projectRoot = await createTempProjectRoot();
    const statePath = await ensureStateDir(projectRoot);
    const state = createValidState();

    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");

    const result = await readState(projectRoot);

    expect(result).toEqual(state);

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("throws an error with a descriptive message when state.json contains malformed JSON", async () => {
    const projectRoot = await createTempProjectRoot();
    const statePath = await ensureStateDir(projectRoot);

    await writeFile(statePath, "{ invalid json", "utf8");

    await expect(readState(projectRoot)).rejects.toThrow(
      /Malformed JSON in state file/,
    );

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("throws an error when state.json fails Zod schema validation", async () => {
    const projectRoot = await createTempProjectRoot();
    const statePath = await ensureStateDir(projectRoot);

    const invalidState = {
      ...createValidState(),
      current_iteration: "not-an-iteration-id",
    };

    await writeFile(statePath, `${JSON.stringify(invalidState, null, 2)}\n`, "utf8");

    await expect(readState(projectRoot)).rejects.toThrow(
      /failed schema validation/,
    );

    await rm(projectRoot, { recursive: true, force: true });
  });
});

describe("writeState", () => {
  it("writes a valid JSON file at the correct path", async () => {
    const projectRoot = await createTempProjectRoot();
    const initialState = createValidState();

    await writeState(projectRoot, initialState);

    const statePath = join(projectRoot, STATE_REL_PATH);
    const contents = await readFile(statePath, "utf8");
    const parsed = JSON.parse(contents) as State;

    expect(parsed.current_iteration).toBe(initialState.current_iteration);
    expect(parsed.current_phase).toBe(initialState.current_phase);
    expect(parsed.phases).toEqual(initialState.phases);

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("updates last_updated to the current timestamp", async () => {
    const projectRoot = await createTempProjectRoot();
    const initialState = createValidState({
      last_updated: "2000-01-01T00:00:00.000Z",
    });

    const before = Date.now();
    await writeState(projectRoot, initialState);
    const after = Date.now();

    const statePath = join(projectRoot, STATE_REL_PATH);
    const contents = await readFile(statePath, "utf8");
    const parsed = JSON.parse(contents) as State;

    const updatedTime = new Date(parsed.last_updated).getTime();

    expect(updatedTime).toBeGreaterThanOrEqual(before);
    expect(updatedTime).toBeLessThanOrEqual(after + 1000);

    await rm(projectRoot, { recursive: true, force: true });
  });
});

