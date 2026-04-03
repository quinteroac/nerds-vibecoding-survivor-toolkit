/**
 * Tests for US-001: Run `define requirement` multiple times
 * Iteration: 000044
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runDefineRequirement } from "../src/commands/define-requirement";
import { readState, writeState, FLOW_REL_DIR, STATE_REL_PATH } from "../src/state";
import type { State } from "../src/schemas/tmpl_state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTempProjectRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-it000044-us001-"));
}

function makeFreshDefineState(overrides: Partial<State> = {}): State {
  return {
    current_iteration: "000044",
    current_phase: "define",
    flow_guardrail: "strict",
    last_updated: "2026-01-01T00:00:00.000Z",
    phases: {
      define: {
        requirement_definition: [],
        prd_generation: { status: "pending", file: null },
      },
      prototype: {},
      refactor: {},
    },
    ...overrides,
  };
}

/** Write state + required skill stub so the agent is bypassed (ide provider exits 0). */
async function setupProject(
  projectRoot: string,
  state: State,
): Promise<void> {
  await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });
  await mkdir(join(projectRoot, ".agents", "skills", "define-requirement"), { recursive: true });
  await writeFile(
    join(projectRoot, STATE_REL_PATH),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    join(projectRoot, ".agents", "skills", "define-requirement", "SKILL.md"),
    "# define-requirement skill\n\nStub skill for tests.",
    "utf8",
  );
}

// ---------------------------------------------------------------------------
// AC01: First run creates it_XXXXXX_product-requirement-document_001.md
// ---------------------------------------------------------------------------

describe("US-001-AC01: First run creates _001.md", () => {
  let projectRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectRoot = await createTempProjectRoot();
    await setupProject(projectRoot, makeFreshDefineState());
    process.chdir(projectRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("first run adds an entry with file = it_000044_product-requirement-document_001.md", async () => {
    await runDefineRequirement({ provider: "ide" });

    const state = await readState(projectRoot);
    const defs = state.phases.define.requirement_definition;

    expect(defs).toHaveLength(1);
    expect(defs[0].index).toBe(1);
    expect(defs[0].status).toBe("in_progress");
    expect(defs[0].file).toBe("it_000044_product-requirement-document_001.md");
  });

  it("first run does not overwrite an existing _001.md file (new entry created without touching it)", async () => {
    const existingFile = join(projectRoot, FLOW_REL_DIR, "it_000044_product-requirement-document_001.md");
    await writeFile(existingFile, "existing content", "utf8");

    await runDefineRequirement({ provider: "ide" });

    const content = await (Bun.file(existingFile).text());
    expect(content).toBe("existing content");
  });
});

// ---------------------------------------------------------------------------
// AC02: Second and subsequent runs create _002.md, _003.md, etc.
// ---------------------------------------------------------------------------

describe("US-001-AC02: Subsequent runs create _002.md, _003.md, …", () => {
  let projectRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("second run creates _002.md entry without overwriting _001.md entry", async () => {
    const stateWithOne = makeFreshDefineState();
    stateWithOne.phases.define.requirement_definition = [
      { index: 1, status: "in_progress", file: "it_000044_product-requirement-document_001.md" },
    ];
    await setupProject(projectRoot, stateWithOne);

    await runDefineRequirement({ provider: "ide" });

    const state = await readState(projectRoot);
    const defs = state.phases.define.requirement_definition;

    expect(defs).toHaveLength(2);
    expect(defs[1].index).toBe(2);
    expect(defs[1].file).toBe("it_000044_product-requirement-document_002.md");
    // First entry is untouched
    expect(defs[0].file).toBe("it_000044_product-requirement-document_001.md");
  });

  it("third run creates _003.md", async () => {
    const stateWithTwo = makeFreshDefineState();
    stateWithTwo.phases.define.requirement_definition = [
      { index: 1, status: "in_progress", file: "it_000044_product-requirement-document_001.md" },
      { index: 2, status: "in_progress", file: "it_000044_product-requirement-document_002.md" },
    ];
    await setupProject(projectRoot, stateWithTwo);

    await runDefineRequirement({ provider: "ide" });

    const state = await readState(projectRoot);
    const defs = state.phases.define.requirement_definition;

    expect(defs).toHaveLength(3);
    expect(defs[2].index).toBe(3);
    expect(defs[2].file).toBe("it_000044_product-requirement-document_003.md");
  });
});

// ---------------------------------------------------------------------------
// AC03: state.json requirement_definition is an array with { index, status, file }
// ---------------------------------------------------------------------------

describe("US-001-AC03: requirement_definition is an array of { index, status, file }", () => {
  let projectRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectRoot = await createTempProjectRoot();
    await setupProject(projectRoot, makeFreshDefineState());
    process.chdir(projectRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("after first run, requirement_definition is an array with one entry containing index, status, file", async () => {
    await runDefineRequirement({ provider: "ide" });

    const state = await readState(projectRoot);
    const defs = state.phases.define.requirement_definition;

    expect(Array.isArray(defs)).toBe(true);
    expect(defs[0]).toMatchObject({
      index: 1,
      status: "in_progress",
      file: "it_000044_product-requirement-document_001.md",
    });
  });

  it("array grows with each run, each entry has unique index", async () => {
    // Simulate two existing in_progress entries
    const state = makeFreshDefineState();
    state.phases.define.requirement_definition = [
      { index: 1, status: "in_progress", file: "it_000044_product-requirement-document_001.md" },
    ];
    await writeFile(
      join(projectRoot, STATE_REL_PATH),
      `${JSON.stringify(state, null, 2)}\n`,
      "utf8",
    );

    await runDefineRequirement({ provider: "ide" });

    const updated = await readState(projectRoot);
    const defs = updated.phases.define.requirement_definition;
    expect(defs.map((e) => e.index)).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// AC04: blocked after approve, unless --force
// ---------------------------------------------------------------------------

describe("US-001-AC04: blocked if any entry is approved (strict mode), --force bypasses", () => {
  let projectRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("throws when any entry has status 'approved' (strict guardrail)", async () => {
    const state = makeFreshDefineState();
    state.phases.define.requirement_definition = [
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
    ];
    await setupProject(projectRoot, state);

    await expect(
      runDefineRequirement({ provider: "ide" }),
    ).rejects.toThrow("already been approved");
  });

  it("with --force, proceeds even when an entry is approved", async () => {
    const state = makeFreshDefineState();
    state.phases.define.requirement_definition = [
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
    ];
    await setupProject(projectRoot, state);

    await runDefineRequirement({ provider: "ide", force: true });

    const updated = await readState(projectRoot);
    const defs = updated.phases.define.requirement_definition;
    expect(defs).toHaveLength(2);
    expect(defs[1].file).toBe("it_000044_product-requirement-document_002.md");
  });

  it("does not throw when no entry is approved", async () => {
    const state = makeFreshDefineState();
    state.phases.define.requirement_definition = [
      { index: 1, status: "in_progress", file: "it_000044_product-requirement-document_001.md" },
    ];
    await setupProject(projectRoot, state);

    await expect(
      runDefineRequirement({ provider: "ide" }),
    ).resolves.toBeUndefined();
  });

  it("relaxed guardrail + rejected prompt still blocks", async () => {
    const originalExitCode = process.exitCode;
    const state = makeFreshDefineState();
    state.flow_guardrail = "relaxed";
    state.phases.define.requirement_definition = [
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
    ];
    await setupProject(projectRoot, state);

    const { GuardrailAbortError } = await import("../src/guardrail");
    await expect(
      runDefineRequirement({ provider: "ide", readLineFn: async () => "n" }),
    ).rejects.toBeInstanceOf(GuardrailAbortError);
    process.exitCode = originalExitCode;
  });
});

// ---------------------------------------------------------------------------
// Legacy migration: old { status, file } object is migrated to array on read
// ---------------------------------------------------------------------------

describe("Legacy migration: old object format is auto-migrated to array", () => {
  let projectRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectRoot = await createTempProjectRoot();
    process.chdir(projectRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("reads an old state.json with object format and migrates to array with index=1", async () => {
    // Write old-format state directly to disk
    const legacyState = {
      current_iteration: "000044",
      current_phase: "define",
      last_updated: "2026-01-01T00:00:00.000Z",
      phases: {
        define: {
          requirement_definition: { status: "in_progress", file: "old.md" },
          prd_generation: { status: "pending", file: null },
        },
        prototype: {},
        refactor: {},
      },
    };
    await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });
    await writeFile(
      join(projectRoot, STATE_REL_PATH),
      `${JSON.stringify(legacyState, null, 2)}\n`,
      "utf8",
    );

    const state = await readState(projectRoot);
    const defs = state.phases.define.requirement_definition;

    expect(Array.isArray(defs)).toBe(true);
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatchObject({ index: 1, status: "in_progress", file: "old.md" });
  });
});
