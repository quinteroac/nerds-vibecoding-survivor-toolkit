import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { StateSchema } from "../../scaffold/schemas/tmpl_state";
import { readState } from "../state";
import { runStartIteration } from "./start-iteration";

const createdRoots: string[] = [];

async function withCwd<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("US-003 state initialization", () => {
  test("US-003-AC03: fresh start-iteration state includes the new prototype loop and validates", async () => {
    const root = await mkdtemp(join(tmpdir(), "nvst-state-loop-"));
    createdRoots.push(root);

    await withCwd(root, async () => {
      await runStartIteration();
    });

    const state = await readState(root);
    expect(StateSchema.safeParse(state).success).toBe(true);
    expect(state.phases.prototype.prototype_creation).toEqual({ status: "pending", file: null });
    expect(state.phases.prototype.prototype_audit).toEqual({ status: "pending", file: null });
    expect(state.phases.prototype.prototype_refactor).toEqual({ status: "pending", file: null });
    expect(state.phases.prototype.prototype_approval).toEqual({ status: "pending", file: null });
  });
});
