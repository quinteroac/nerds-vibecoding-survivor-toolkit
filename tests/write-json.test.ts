import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runWriteJson } from "../src/commands/write-json";
import type { State } from "../scaffold/schemas/tmpl_state";

async function createTempProjectRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-write-json-test-"));
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

describe("runWriteJson", () => {
  let originalCwd: string;
  let originalExitCode: number | undefined;
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let loggedMessages: string[];
  let errorMessages: string[];

  beforeEach(() => {
    originalCwd = process.cwd();
    originalExitCode = process.exitCode;
    process.exitCode = 0;

    loggedMessages = [];
    errorMessages = [];

    originalLog = console.log;
    originalError = console.error;

    console.log = (msg?: unknown, ...rest: unknown[]) => {
      loggedMessages.push([msg, ...rest].join(" "));
    };
    console.error = (msg?: unknown, ...rest: unknown[]) => {
      errorMessages.push([msg, ...rest].join(" "));
    };
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.exitCode = originalExitCode ?? 0;
    console.log = originalLog;
    console.error = originalError;
  });

  it("writes a state JSON file when given a valid payload and required flags", async () => {
    const projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);

    const outPath = "state.json";
    const payload = createValidState();

    await runWriteJson({
      args: ["--schema", "state", "--out", outPath, "--data", JSON.stringify(payload)],
    });

    const written = await readFile(join(projectRoot, outPath), "utf8");
    const parsed = JSON.parse(written) as State;

    expect(parsed.current_iteration).toBe(payload.current_iteration);
    expect(parsed.current_phase).toBe(payload.current_phase);
    expect(parsed.phases).toEqual(payload.phases);
    expect(typeof parsed.last_updated).toBe("string");
    expect(process.exitCode).toBe(0);
    expect(loggedMessages.some((msg) => msg.includes(`Written: ${outPath}`))).toBe(true);

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("sets exitCode=1 and prints an error when --schema is missing", async () => {
    const projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);

    await runWriteJson({
      args: ["--out", "state.json", "--data", JSON.stringify(createValidState())],
    });

    expect(process.exitCode).toBe(1);
    expect(errorMessages[0]).toContain("--schema <name> is required.");

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("sets exitCode=1 and prints an error for an unknown schema name", async () => {
    const projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);

    await runWriteJson({
      args: ["--schema", "unknown-schema", "--out", "state.json", "--data", "{}"],
    });

    expect(process.exitCode).toBe(1);
    expect(errorMessages[0]).toContain('Unknown schema "unknown-schema".');

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("sets exitCode=1 and prints an error when --out is missing", async () => {
    const projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);

    await runWriteJson({
      args: ["--schema", "state", "--data", JSON.stringify(createValidState())],
    });

    expect(process.exitCode).toBe(1);
    expect(errorMessages[0]).toContain("--out <path> is required.");

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("sets exitCode=1 when the JSON payload fails Zod schema validation", async () => {
    const projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);

    const invalidPayload = {
      ...createValidState(),
      current_iteration: "invalid-iteration-id",
    };

    await runWriteJson({
      args: ["--schema", "state", "--out", "state.json", "--data", JSON.stringify(invalidPayload)],
    });

    expect(process.exitCode).toBe(1);
    expect(errorMessages.length).toBeGreaterThan(0);

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("sets exitCode=1 when the JSON payload is malformed", async () => {
    const projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);

    await runWriteJson({
      args: ["--schema", "state", "--out", "state.json", "--data", "{ not valid json"],
    });

    expect(process.exitCode).toBe(1);
    expect(errorMessages[0]).toContain("Invalid JSON input.");

    await rm(projectRoot, { recursive: true, force: true });
  });
});

