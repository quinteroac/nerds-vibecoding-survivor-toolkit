/**
 * Tests for US-006: Backward compatibility — single-PRD iterations continue to work
 * Iteration: 000044
 *
 * Verifies that legacy `requirement_definition` single-object format (pre-multi-PRD)
 * is auto-migrated and that all commands continue to work unchanged.
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readState, STATE_REL_PATH } from "../src/state";
import { StateSchema } from "../src/schemas/tmpl_state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTempProjectRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-it000044-us006-"));
}

async function ensureStateDir(projectRoot: string): Promise<string> {
  const statePath = join(projectRoot, STATE_REL_PATH);
  await mkdir(join(projectRoot, ".agents"), { recursive: true });
  return statePath;
}

/** Writes raw JSON (bypassing Zod) so we can test the migration path. */
async function writeLegacyState(
  projectRoot: string,
  legacyRequirementDefinition: unknown,
): Promise<void> {
  const statePath = await ensureStateDir(projectRoot);
  const raw = {
    current_iteration: "000001",
    current_phase: "define",
    phases: {
      define: {
        requirement_definition: legacyRequirementDefinition,
        prd_generation: { status: "pending", file: null },
      },
      prototype: {},
      refactor: {},
    },
    last_updated: "2024-01-01T00:00:00.000Z",
  };
  await writeFile(statePath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
}

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await createTempProjectRoot();
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// AC01 — Schema auto-migration of legacy single-object format
// ---------------------------------------------------------------------------

describe("US-006-AC01: legacy requirement_definition is auto-migrated", () => {
  it("migrates a legacy {status, file} object to [{index:1, status, file}] on readState", async () => {
    await writeLegacyState(projectRoot, { status: "approved", file: "prd.md" });

    const state = await readState(projectRoot);
    const reqDef = state.phases.define.requirement_definition;

    expect(Array.isArray(reqDef)).toBe(true);
    expect(reqDef).toHaveLength(1);
    expect(reqDef[0]).toEqual({ index: 1, status: "approved", file: "prd.md" });
  });

  it("migrates a legacy {status:'in_progress', file:null} object correctly", async () => {
    await writeLegacyState(projectRoot, { status: "in_progress", file: null });

    const state = await readState(projectRoot);
    const reqDef = state.phases.define.requirement_definition;

    expect(reqDef).toHaveLength(1);
    expect(reqDef[0]).toEqual({ index: 1, status: "in_progress", file: null });
  });

  it("migrates a legacy {status:'pending', file:null} object correctly", async () => {
    await writeLegacyState(projectRoot, { status: "pending", file: null });

    const state = await readState(projectRoot);
    const reqDef = state.phases.define.requirement_definition;

    expect(reqDef).toHaveLength(1);
    expect(reqDef[0]).toEqual({ index: 1, status: "pending", file: null });
  });

  it("leaves an already-array requirement_definition unchanged", async () => {
    const modern = [{ index: 1, status: "approved", file: "prd.md" }];
    await writeLegacyState(projectRoot, modern);

    const state = await readState(projectRoot);
    const reqDef = state.phases.define.requirement_definition;

    expect(reqDef).toEqual(modern);
  });

  it("handles an empty array requirement_definition without mutation", async () => {
    await writeLegacyState(projectRoot, []);

    const state = await readState(projectRoot);
    expect(state.phases.define.requirement_definition).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC01 — StateSchema.safeParse directly handles legacy shape
// ---------------------------------------------------------------------------

describe("US-006-AC01: StateSchema.safeParse handles legacy shape", () => {
  const baseState = {
    current_iteration: "000001",
    current_phase: "define",
    phases: {
      define: {
        prd_generation: { status: "pending", file: null },
      },
      prototype: {},
      refactor: {},
    },
    last_updated: "2024-01-01T00:00:00.000Z",
  };

  it("parses legacy single-object requirement_definition successfully", () => {
    const raw = {
      ...baseState,
      phases: {
        ...baseState.phases,
        define: {
          ...baseState.phases.define,
          requirement_definition: { status: "approved", file: "prd.md" },
        },
      },
    };

    const result = StateSchema.safeParse(raw);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phases.define.requirement_definition).toEqual([
        { index: 1, status: "approved", file: "prd.md" },
      ]);
    }
  });

  it("parses modern array requirement_definition successfully", () => {
    const raw = {
      ...baseState,
      phases: {
        ...baseState.phases,
        define: {
          ...baseState.phases.define,
          requirement_definition: [
            { index: 1, status: "approved", file: "prd-1.md" },
            { index: 2, status: "in_progress", file: "prd-2.md" },
          ],
        },
      },
    };

    const result = StateSchema.safeParse(raw);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phases.define.requirement_definition).toHaveLength(2);
      expect(result.data.phases.define.requirement_definition[0].index).toBe(1);
      expect(result.data.phases.define.requirement_definition[1].index).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// AC02 — result shape is always an array after parsing
// ---------------------------------------------------------------------------

describe("US-006-AC02: requirement_definition is always an array after schema parsing", () => {
  it("result of safeParse is always an array regardless of input shape", () => {
    const legacyRaw = {
      current_iteration: "000001",
      current_phase: "define",
      phases: {
        define: {
          requirement_definition: { status: "approved", file: "old-prd.md" },
          prd_generation: { status: "pending", file: null },
        },
        prototype: {},
        refactor: {},
      },
      last_updated: "2024-01-01T00:00:00.000Z",
    };

    const result = StateSchema.safeParse(legacyRaw);

    expect(result.success).toBe(true);
    if (result.success) {
      const reqDef = result.data.phases.define.requirement_definition;
      // The type is always an array — commands can safely call array methods on it
      expect(Array.isArray(reqDef)).toBe(true);
      expect(typeof reqDef.find).toBe("function");
      expect(typeof reqDef.filter).toBe("function");
      expect(typeof reqDef.some).toBe("function");
      expect(typeof reqDef.sort).toBe("function");
    }
  });
});
