import { $ as dollar } from "bun";

import { readState } from "../state";

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface ApprovePrototypeDeps {
  logFn: (message: string) => void;
  readStateFn: typeof readState;
  runGitStatusFn: (projectRoot: string) => Promise<CommandResult>;
  runStageAndCommitFn: (projectRoot: string, message: string) => Promise<CommandResult>;
}

const defaultDeps: ApprovePrototypeDeps = {
  logFn: console.log,
  readStateFn: readState,
  runGitStatusFn: async (projectRoot: string): Promise<CommandResult> => {
    const result = await dollar`git status --porcelain`
      .cwd(projectRoot)
      .nothrow()
      .quiet();
    return {
      exitCode: result.exitCode,
      stdout: result.stdout.toString().trim(),
      stderr: result.stderr.toString().trim(),
    };
  },
  runStageAndCommitFn: async (projectRoot: string, message: string): Promise<CommandResult> => {
    const result = await dollar`git add -A && git commit -m ${message}`
      .cwd(projectRoot)
      .nothrow()
      .quiet();
    return {
      exitCode: result.exitCode,
      stdout: result.stdout.toString().trim(),
      stderr: result.stderr.toString().trim(),
    };
  },
};

export async function runApprovePrototype(
  deps: Partial<ApprovePrototypeDeps> = {},
): Promise<void> {
  const mergedDeps = { ...defaultDeps, ...deps };
  const projectRoot = process.cwd();
  const state = await mergedDeps.readStateFn(projectRoot);
  const commitMessage = `feat: approve prototype it_${state.current_iteration}`;

  const statusResult = await mergedDeps.runGitStatusFn(projectRoot);
  if (statusResult.exitCode !== 0) {
    throw new Error(
      `Failed to inspect git working tree: ${statusResult.stderr || "git status command failed."}`,
    );
  }

  if (!statusResult.stdout) {
    mergedDeps.logFn("No pending changes to commit; working tree is clean.");
    return;
  }

  const commitResult = await mergedDeps.runStageAndCommitFn(projectRoot, commitMessage);
  if (commitResult.exitCode !== 0) {
    throw new Error(
      `Failed to create prototype approval commit: ${commitResult.stderr || "git commit command failed."}`,
    );
  }

  mergedDeps.logFn(`Committed prototype changes with message: ${commitMessage}`);
}
