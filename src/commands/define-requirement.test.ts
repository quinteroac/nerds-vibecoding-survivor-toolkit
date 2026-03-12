import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readState, writeState } from "../state";
import type { State } from "../../scaffold/schemas/tmpl_state";
import { runDefineRequirement } from "./define-requirement";

const createdRoots: string[] = [];

async function createProjectRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "nvst-define-requirement-"));
  createdRoots.push(root);
  return root;
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

function buildState(): State {
  return {
    current_iteration: "000023",
    current_phase: "define",
    phases: {
      define: {
        requirement_definition: { status: "pending", file: null },
        prd_generation: { status: "pending", file: null },
      },
      prototype: {
        prototype_creation: { status: "pending", file: null },
        prototype_audit: { status: "pending", file: null },
        prototype_refactor: { status: "pending", file: null },
        prototype_approval: { status: "pending", file: null },
        project_context: { status: "pending", file: null },
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
    last_updated: "2026-03-12T00:00:00.000Z",
    updated_by: "seed",
    history: [],
  };
}

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("define requirement command", () => {
  test("updates state and prints built skill prompt when provider is ide", async () => {
    const projectRoot = await createProjectRoot();
    await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });
    await mkdir(join(projectRoot, ".agents", "skills", "create-pr-document"), { recursive: true });
    await writeFile(
      join(projectRoot, ".agents", "skills", "create-pr-document", "SKILL.md"),
      "---\nname: create-pr-document\n---\n# Create PRD Skill",
      "utf8",
    );
    await writeState(projectRoot, buildState());

    const writes: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      await withCwd(projectRoot, async () => {
        await runDefineRequirement({ provider: "ide" });
      });
    } finally {
      process.stdout.write = originalWrite;
    }

    const writtenText = writes.join("");
    expect(writtenText).toContain("# Create PRD Skill");
    expect(writtenText).toContain("## Context");
    expect(writtenText).toContain("### current_iteration");
    expect(writtenText).toContain("000023");

    const state = await readState(projectRoot);
    expect(state.phases.define.requirement_definition.status).toBe("in_progress");
    expect(state.phases.define.requirement_definition.file).toBe(
      "it_000023_product-requirement-document.md",
    );
    expect(state.updated_by).toBe("nvst:define-requirement");

    const stateRaw = await readFile(join(projectRoot, ".agents", "state.json"), "utf8");
    expect(stateRaw).toContain("\"in_progress\"");
  });
});
