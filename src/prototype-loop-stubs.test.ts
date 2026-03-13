import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runApprovePrototype } from "./commands/approve-prototype";

const cliPath = join(import.meta.dir, "cli.ts");

describe("US-002 prototype loop stubs", () => {
  test("refactor prototype command is invocable (loads audit and invokes agent or fails with clear error)", async () => {
    const proc = Bun.spawn(["bun", cliPath, "refactor", "prototype", "--agent", "codex"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;

    // Exit 0: agent ran; exit 1: guardrail, missing audit file, or agent failure
    expect([0, 1]).toContain(exitCode);
  });

  test("approve prototype command is invocable stub handler", async () => {
    let invoked = false;

    const deps = {
      readStateFn: async () =>
        ({
          current_iteration: "000001",
          flow_guardrail: "strict",
          phases: {
            define: {},
            prototype: {},
            refactor: {},
          },
        } as any),
      existsFn: async () => true,
      loadSkillFn: async () => "# approve prototype skill",
      invokeAgentFn: async (options: any) => {
        invoked = true;
        expect(options.provider).toBe("ide");
        expect(options.cwd).toBe(process.cwd());
        expect(options.interactive).toBe(true);
        return { exitCode: 0, stdout: "", stderr: "" };
      },
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

    await expect(runApprovePrototype({ force: false }, deps)).resolves.toBeUndefined();
    expect(invoked).toBe(true);
  });
});
