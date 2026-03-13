import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { State } from "../scaffold/schemas/tmpl_state";
import { runApproveProjectContext } from "./commands/approve-project-context";
import { runApprovePrototype } from "./commands/approve-prototype";

const createdRoots: string[] = [];

function buildState(flow_guardrail: "strict" | "relaxed"): State {
  return {
    current_iteration: "000015",
    current_phase: "prototype",
    flow_guardrail,
    phases: {
      define: {
        requirement_definition: { status: "approved", file: "it_000015_product-requirement-document.md" },
        prd_generation: { status: "completed", file: "it_000015_PRD.json" },
      },
      prototype: {
        project_context: { status: "pending", file: ".agents/PROJECT_CONTEXT.md" },
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
    last_updated: "2026-01-01T00:00:00.000Z",
    updated_by: "test",
  };
}

async function seedProject(flowGuardrail: "strict" | "relaxed"): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "nvst-force-"));
  createdRoots.push(root);
  await mkdir(join(root, ".agents", "flow"), { recursive: true });
  await writeFile(
    join(root, ".agents", "state.json"),
    `${JSON.stringify(buildState(flowGuardrail), null, 2)}\n`,
    "utf8",
  );
  await writeFile(join(root, ".agents", "PROJECT_CONTEXT.md"), "# Project Context\n", "utf8");
  return root;
}

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("US-002 --force support", () => {
  test("US-002-AC01: cli forwards --force to current loop command handlers", async () => {
    const source = await readFile(join(import.meta.dir, "cli.ts"), "utf8");
    expect(source).toContain("await runDefineRequirement({ provider, force })");
    expect(source).toContain("await runRefineRequirement({ provider, challenge, force })");
    expect(source).toContain("await runApproveRequirement({ force })");
    expect(source).toContain("await runApprovePrototype({ force })");
    expect(source).toContain("await runCreatePrototype({ provider, iterations, retryOnFail, stopOnCritical, force })");
    expect(source).toContain("await runAuditPrototype({ provider, force })");
    expect(source).toContain("await runRefactorPrototype({ provider, force })");
  });

  test("US-002-AC02/AC03: strict mode + --force warns and bypasses prompt", async () => {
    const root = await seedProject("strict");
    const previousCwd = process.cwd();
    const messages: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: unknown) => {
      messages.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      process.chdir(root);
      await runApproveProjectContext({ force: true });
    } finally {
      process.stderr.write = originalWrite;
      process.chdir(previousCwd);
    }

    const state = JSON.parse(
      await readFile(join(root, ".agents", "state.json"), "utf8"),
    ) as State;
    expect(state.phases.prototype.project_context?.status).toBe("created");
    expect(messages.join("")).toContain(
      "Warning: Cannot approve project context from status 'pending'. Expected pending_approval.",
    );
    expect(messages.join("")).not.toContain("Proceed anyway? [y/N]");
  });

  test("US-002-AC03: relaxed mode + --force also bypasses prompt", async () => {
    const root = await seedProject("relaxed");
    const previousCwd = process.cwd();
    const messages: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: unknown) => {
      messages.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      process.chdir(root);
      await runApproveProjectContext({ force: true });
    } finally {
      process.stderr.write = originalWrite;
      process.chdir(previousCwd);
    }

    expect(messages.join("")).toContain(
      "Warning: Cannot approve project context from status 'pending'. Expected pending_approval.",
    );
    expect(messages.join("")).not.toContain("Proceed anyway? [y/N]");
  });

  test("US-002-AC04: commands without guardrail checks ignore --force when successful", async () => {
    const state = buildState("strict");
    const deps = {
      readStateFn: async () => state,
      existsFn: async () => true,
      loadSkillFn: async () => "# approve prototype skill",
      invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      readChangedFilesFn: async () => [],
      promptGitOpsConfirmationFn: async () => {
        throw new Error("promptForGitOperationsConfirmation should not be called when there are no changed files.");
      },
      gitAddAndCommitFn: async () => {
        throw new Error("gitAddAndCommitFn should not be called when there are no changed files.");
      },
      getCurrentBranchFn: async () => {
        throw new Error("getCurrentBranchFn should not be called when there are no changed files.");
      },
      gitPushFn: async () => {
        throw new Error("gitPushFn should not be called when there are no changed files.");
      },
      checkGhAvailableFn: async () => {
        throw new Error("checkGhAvailableFn should not be called when there are no changed files.");
      },
      createPullRequestFn: async () => {
        throw new Error("createPullRequestFn should not be called when there are no changed files.");
      },
      warnFn: () => {
        throw new Error("warnFn should not be called when there are no changed files.");
      },
      writeStateFn: async () => {
        // no-op for this test
      },
    } as any;

    await expect(runApprovePrototype({ force: true }, deps)).resolves.toBeUndefined();
  });
});
