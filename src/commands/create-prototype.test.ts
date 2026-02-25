import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";

import { readState, writeState } from "../state";
import type { State } from "../../scaffold/schemas/tmpl_state";
import { runCreatePrototype } from "./create-prototype";

async function createProjectRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-create-prototype-"));
}

async function withCwd<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

function makeState(overrides: {
  currentPhase?: State["current_phase"];
  prdStatus?: "pending" | "completed";
  projectContextStatus?: "pending" | "pending_approval" | "created";
  iteration?: string;
} = {}): State {
  const iteration = overrides.iteration ?? "000009";
  return {
    current_iteration: iteration,
    current_phase: overrides.currentPhase ?? "prototype",
    phases: {
      define: {
        requirement_definition: { status: "approved", file: `it_${iteration}_product-requirement-document.md` },
        prd_generation: { status: overrides.prdStatus ?? "completed", file: `it_${iteration}_PRD.json` },
      },
      prototype: {
        project_context: { status: overrides.projectContextStatus ?? "created", file: ".agents/PROJECT_CONTEXT.md" },
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
    last_updated: "2026-02-22T00:00:00.000Z",
    updated_by: "seed",
    history: [],
  };
}

async function seedState(projectRoot: string, state: State): Promise<void> {
  await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });
  await writeState(projectRoot, state);
}

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("create prototype phase validation", () => {
  test("throws when current_phase is define and PRD is not completed", async () => {
    const root = await createProjectRoot();
    createdRoots.push(root);
    await seedState(root, makeState({ currentPhase: "define", prdStatus: "pending", projectContextStatus: "pending" }));

    await withCwd(root, async () => {
      await expect(runCreatePrototype({ provider: "claude" })).rejects.toThrow(
        "Cannot create prototype: current_phase is define and prerequisites are not met.",
      );
    });
  });

  test("throws when current_phase is define and project_context is not created", async () => {
    const root = await createProjectRoot();
    createdRoots.push(root);
    await seedState(root, makeState({ currentPhase: "define", prdStatus: "completed", projectContextStatus: "pending" }));

    await withCwd(root, async () => {
      await expect(runCreatePrototype({ provider: "claude" })).rejects.toThrow(
        "Cannot create prototype: current_phase is define and prerequisites are not met.",
      );
    });
  });

  test("auto-transitions from define to prototype and starts build in same run when PRD and git are ready", async () => {
    const root = await createProjectRoot();
    createdRoots.push(root);
    const iteration = "000009";
    await seedState(root, makeState({ currentPhase: "define", prdStatus: "completed", projectContextStatus: "created", iteration }));

    const prdContent = {
      goals: ["Test"],
      userStories: [
        { id: "US-001", title: "One", description: "D", acceptanceCriteria: [{ id: "AC1", text: "T" }] },
      ],
      functionalRequirements: [{ id: "FR-001", description: "F" }],
    };
    await writeFile(
      join(root, ".agents", "flow", `it_${iteration}_PRD.json`),
      JSON.stringify(prdContent),
      "utf8",
    );

    const { $ } = await import("bun");
    await $`git init`.cwd(root).nothrow().quiet();

    await withCwd(root, async () => {
      await expect(runCreatePrototype({ provider: "claude" })).rejects.toThrow(
        "Required skill missing",
      );
    });

    const updatedState = await readState(root);
    expect(updatedState.current_phase).toBe("prototype");
  });

  test("throws when current_phase is refactor", async () => {
    const root = await createProjectRoot();
    createdRoots.push(root);
    await seedState(root, makeState({ currentPhase: "refactor" }));

    await withCwd(root, async () => {
      await expect(runCreatePrototype({ provider: "claude" })).rejects.toThrow(
        "Cannot create prototype: current_phase must be define (with approved PRD) or prototype.",
      );
    });
  });

  test("proceeds when current_phase is already prototype", async () => {
    const root = await createProjectRoot();
    createdRoots.push(root);
    await seedState(root, makeState({ currentPhase: "prototype" }));

    // Passes phase check, fails later at PRD file lookup.
    await withCwd(root, async () => {
      await expect(runCreatePrototype({ provider: "claude" })).rejects.toThrow(
        "PRD source of truth missing",
      );
    });
  });
});
