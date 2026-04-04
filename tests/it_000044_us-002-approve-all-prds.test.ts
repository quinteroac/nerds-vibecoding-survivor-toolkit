/**
 * Tests for US-002: `approve requirement` approves all pending PRDs
 * Iteration: 000044
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runApproveRequirement } from "../src/commands/approve-requirement";
import { readState, writeState, FLOW_REL_DIR, STATE_REL_PATH } from "../src/state";
import type { State } from "../src/schemas/tmpl_state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MINIMAL_PRD_MARKDOWN = `
## Goals

- Test goal

## User Stories

### US-001: Test story

As a user I want to test.

**Acceptance Criteria:**
- [ ] AC01

## Functional Requirements

- FR-1: test requirement
`.trim();

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-it000044-us002-"));
}

function makeState(
  requirementDefs: State["phases"]["define"]["requirement_definition"],
  overrides: Partial<State> = {},
): State {
  return {
    current_iteration: "000044",
    current_phase: "define",
    flow_guardrail: "strict",
    last_updated: "2026-01-01T00:00:00.000Z",
    phases: {
      define: {
        requirement_definition: requirementDefs,
        prd_generation: { status: "pending", file: null },
      },
      prototype: {},
      refactor: {},
    },
    ...overrides,
  };
}

async function setupProject(projectRoot: string, state: State, prdFiles: Record<string, string> = {}): Promise<void> {
  await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });
  await writeFile(join(projectRoot, STATE_REL_PATH), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  for (const [filename, content] of Object.entries(prdFiles)) {
    await writeFile(join(projectRoot, FLOW_REL_DIR, filename), content, "utf8");
  }
}

// Fake invokeWriteJsonFn that always succeeds
const fakeWriteJsonOk = async () => ({ exitCode: 0, stderr: "" });
// Fake invokeWriteJsonFn that always fails
const fakeWriteJsonFail = async () => ({ exitCode: 1, stderr: "schema validation error" });

// ---------------------------------------------------------------------------
// AC01: sets status = "approved" on every in_progress entry
// ---------------------------------------------------------------------------

describe("US-002-AC01: approves all in_progress entries", () => {
  let projectRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectRoot = await createTempDir();
    process.chdir(projectRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("approves a single in_progress entry", async () => {
    const state = makeState([
      { index: 1, status: "in_progress", file: "it_000044_product-requirement-document_001.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN,
    });

    await runApproveRequirement({ force: true }, { invokeWriteJsonFn: fakeWriteJsonOk });

    const updated = await readState(projectRoot);
    expect(updated.phases.define.requirement_definition[0].status).toBe("approved");
  });

  it("approves all three in_progress entries", async () => {
    const state = makeState([
      { index: 1, status: "in_progress", file: "it_000044_product-requirement-document_001.md" },
      { index: 2, status: "in_progress", file: "it_000044_product-requirement-document_002.md" },
      { index: 3, status: "in_progress", file: "it_000044_product-requirement-document_003.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN,
      "it_000044_product-requirement-document_002.md": MINIMAL_PRD_MARKDOWN,
      "it_000044_product-requirement-document_003.md": MINIMAL_PRD_MARKDOWN,
    });

    await runApproveRequirement({ force: true }, { invokeWriteJsonFn: fakeWriteJsonOk });

    const updated = await readState(projectRoot);
    const defs = updated.phases.define.requirement_definition;
    expect(defs).toHaveLength(3);
    expect(defs.every((e) => e.status === "approved")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC02: already approved entries are skipped (idempotent)
// ---------------------------------------------------------------------------

describe("US-002-AC02: skips already approved entries (idempotent)", () => {
  let projectRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectRoot = await createTempDir();
    process.chdir(projectRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("only processes in_progress entries when some are already approved", async () => {
    const state = makeState([
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
      { index: 2, status: "in_progress", file: "it_000044_product-requirement-document_002.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_002.md": MINIMAL_PRD_MARKDOWN,
    });

    let invokeCount = 0;
    const countingInvoker = async () => {
      invokeCount++;
      return { exitCode: 0, stderr: "" };
    };

    await runApproveRequirement({ force: true }, { invokeWriteJsonFn: countingInvoker });

    // write-json was called only once (for entry #2, not #1)
    expect(invokeCount).toBe(1);

    const updated = await readState(projectRoot);
    expect(updated.phases.define.requirement_definition[0].status).toBe("approved");
    expect(updated.phases.define.requirement_definition[1].status).toBe("approved");
  });

  it("throws (guardrail) when all entries are already approved and no in_progress remains", async () => {
    const state = makeState([
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
    ]);
    await setupProject(projectRoot, state);

    await expect(
      runApproveRequirement({ force: false }, { invokeWriteJsonFn: fakeWriteJsonOk }),
    ).rejects.toThrow("no in_progress requirement definition found");
  });
});

// ---------------------------------------------------------------------------
// AC03: confirmation prompt lists PRDs before proceeding
// ---------------------------------------------------------------------------

describe("US-002-AC03: confirmation prompt lists all PRDs", () => {
  let projectRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectRoot = await createTempDir();
    process.chdir(projectRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("lists all PRD files in the prompt output", async () => {
    const state = makeState([
      { index: 1, status: "in_progress", file: "it_000044_product-requirement-document_001.md" },
      { index: 2, status: "in_progress", file: "it_000044_product-requirement-document_002.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN,
      "it_000044_product-requirement-document_002.md": MINIMAL_PRD_MARKDOWN,
    });

    const outputLines: string[] = [];
    const captureOutput = (msg: string) => { outputLines.push(msg); };

    // Confirm with "y"
    await runApproveRequirement(
      {},
      {
        invokeWriteJsonFn: fakeWriteJsonOk,
        readLineFn: async () => "y",
        stdoutWriteFn: captureOutput,
      },
    );

    const listed = outputLines.join("\n");
    expect(listed).toContain("it_000044_product-requirement-document_001.md");
    expect(listed).toContain("it_000044_product-requirement-document_002.md");
    expect(listed).toContain("will be approved");
  });

  it("aborts when user answers 'n' to confirmation prompt", async () => {
    const state = makeState([
      { index: 1, status: "in_progress", file: "it_000044_product-requirement-document_001.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN,
    });

    let invokeCount = 0;
    await runApproveRequirement(
      {},
      {
        invokeWriteJsonFn: async () => { invokeCount++; return { exitCode: 0, stderr: "" }; },
        readLineFn: async () => "n",
        stdoutWriteFn: () => {},
      },
    );

    // write-json should NOT have been called
    expect(invokeCount).toBe(0);

    // State should be unchanged
    const updated = await readState(projectRoot);
    expect(updated.phases.define.requirement_definition[0].status).toBe("in_progress");
  });

  it("skips confirmation prompt when force=true", async () => {
    const state = makeState([
      { index: 1, status: "in_progress", file: "it_000044_product-requirement-document_001.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN,
    });

    let readLineCalled = false;

    await runApproveRequirement(
      { force: true },
      {
        invokeWriteJsonFn: fakeWriteJsonOk,
        readLineFn: async () => { readLineCalled = true; return "n"; },
        stdoutWriteFn: () => {},
      },
    );

    expect(readLineCalled).toBe(false);

    const updated = await readState(projectRoot);
    expect(updated.phases.define.requirement_definition[0].status).toBe("approved");
  });
});

// ---------------------------------------------------------------------------
// AC04: state.json persisted with all entries marked approved
// ---------------------------------------------------------------------------

describe("US-002-AC04: state.json persisted with all entries approved", () => {
  let projectRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectRoot = await createTempDir();
    process.chdir(projectRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("persists state with all in_progress entries set to approved", async () => {
    const state = makeState([
      { index: 1, status: "in_progress", file: "it_000044_product-requirement-document_001.md" },
      { index: 2, status: "in_progress", file: "it_000044_product-requirement-document_002.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN,
      "it_000044_product-requirement-document_002.md": MINIMAL_PRD_MARKDOWN,
    });

    await runApproveRequirement({ force: true }, { invokeWriteJsonFn: fakeWriteJsonOk });

    const persisted = await readState(projectRoot);
    const defs = persisted.phases.define.requirement_definition;

    expect(defs).toHaveLength(2);
    expect(defs.every((e) => e.status === "approved")).toBe(true);
    expect(persisted.phases.define.prd_generation.status).toBe("completed");
    expect(persisted.phases.define.prd_generation.file).toBe("it_000044_PRD_002.json");
  });

  it("prd_generation.file reflects the iteration PRD JSON filename", async () => {
    const state = makeState([
      { index: 1, status: "in_progress", file: "it_000044_product-requirement-document_001.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN,
    });

    await runApproveRequirement({ force: true }, { invokeWriteJsonFn: fakeWriteJsonOk });

    const persisted = await readState(projectRoot);
    expect(persisted.phases.define.prd_generation.file).toBe("it_000044_PRD_001.json");
  });

  it("does not persist state if write-json fails", async () => {
    const originalExitCode = process.exitCode;
    const state = makeState([
      { index: 1, status: "in_progress", file: "it_000044_product-requirement-document_001.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN,
    });

    await runApproveRequirement({ force: true }, { invokeWriteJsonFn: fakeWriteJsonFail });

    const persisted = await readState(projectRoot);
    // Entry should still be in_progress since write-json failed
    expect(persisted.phases.define.requirement_definition[0].status).toBe("in_progress");
    process.exitCode = originalExitCode;
  });

  it("uses legacy unsuffixed PRD file when suffixed state file is missing", async () => {
    const state = makeState([
      { index: 1, status: "in_progress", file: "it_000044_product-requirement-document_001.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document.md": MINIMAL_PRD_MARKDOWN,
    });

    await runApproveRequirement({ force: true }, { invokeWriteJsonFn: fakeWriteJsonOk });

    const persisted = await readState(projectRoot);
    const entry = persisted.phases.define.requirement_definition[0];
    expect(entry.status).toBe("approved");
    expect(entry.file).toBe("it_000044_product-requirement-document.md");
    expect(persisted.phases.define.prd_generation.file).toBe("it_000044_PRD_001.json");
  });
});
