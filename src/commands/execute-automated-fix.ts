import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ as dollar } from "bun";

import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentInvokeOptions,
  type AgentProvider,
  type AgentResult,
} from "../agent";
import { exists, FLOW_REL_DIR, readState } from "../state";
import { IssuesSchema, type Issue } from "../../scaffold/schemas/tmpl_issues";

export interface ExecuteAutomatedFixOptions {
  provider: AgentProvider;
  retryOnFail?: number;
}

interface ExecuteAutomatedFixDeps {
  existsFn: (path: string) => Promise<boolean>;
  invokeAgentFn: (options: AgentInvokeOptions) => Promise<AgentResult>;
  loadSkillFn: (projectRoot: string, skillName: string) => Promise<string>;
  logFn: (message: string) => void;
  nowFn: () => Date;
  readFileFn: typeof readFile;
  runCommitFn: (projectRoot: string, message: string) => Promise<number>;
  writeFileFn: typeof writeFile;
}

const defaultDeps: ExecuteAutomatedFixDeps = {
  existsFn: exists,
  invokeAgentFn: invokeAgent,
  loadSkillFn: loadSkill,
  logFn: console.log,
  nowFn: () => new Date(),
  readFileFn: readFile,
  runCommitFn: async (projectRoot: string, message: string) => {
    const result = await dollar`git add -A && git commit -m ${message}`
      .cwd(projectRoot)
      .nothrow()
      .quiet();
    return result.exitCode;
  },
  writeFileFn: writeFile,
};

function isNetworkErrorText(text: string): boolean {
  const normalized = text.toLowerCase();
  return [
    "network",
    "econnrefused",
    "enotfound",
    "eai_again",
    "timed out",
    "timeout",
    "connection reset",
    "connection refused",
  ].some((token) => normalized.includes(token));
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return isNetworkErrorText(error.message);
  }
  return isNetworkErrorText(String(error));
}

function sortIssuesById(issues: Issue[]): Issue[] {
  return [...issues].sort((left, right) => left.id.localeCompare(right.id));
}

async function writeIssuesFile(
  issuesPath: string,
  issues: Issue[],
  deps: ExecuteAutomatedFixDeps,
): Promise<void> {
  await deps.writeFileFn(issuesPath, `${JSON.stringify(issues, null, 2)}\n`, "utf8");
}

async function commitIssueUpdate(
  projectRoot: string,
  issueId: string,
  issueStatus: Issue["status"],
  deps: ExecuteAutomatedFixDeps,
): Promise<boolean> {
  const commitMessage = `fix: automated-fix ${issueId} -> ${issueStatus}`;
  const exitCode = await deps.runCommitFn(projectRoot, commitMessage);
  return exitCode === 0;
}

export async function runExecuteAutomatedFix(
  opts: ExecuteAutomatedFixOptions,
  deps: Partial<ExecuteAutomatedFixDeps> = {},
): Promise<void> {
  if (
    opts.retryOnFail !== undefined &&
    (!Number.isInteger(opts.retryOnFail) || opts.retryOnFail < 0)
  ) {
    throw new Error("Invalid --retry-on-fail value. Expected an integer >= 0.");
  }

  const mergedDeps = { ...defaultDeps, ...deps };
  const projectRoot = process.cwd();
  const state = await readState(projectRoot);

  const iteration = state.current_iteration;
  const fileName = `it_${iteration}_ISSUES.json`;
  const issuesPath = join(projectRoot, FLOW_REL_DIR, fileName);

  if (!(await mergedDeps.existsFn(issuesPath))) {
    throw new Error(
      `Issues file not found: expected ${join(FLOW_REL_DIR, fileName)}. Run \`bun nvst create issue --agent <provider>\` first.`,
    );
  }

  let parsedIssuesRaw: unknown;
  try {
    parsedIssuesRaw = JSON.parse(await mergedDeps.readFileFn(issuesPath, "utf8"));
  } catch {
    throw new Error(
      `Deterministic validation error: invalid issues JSON in ${join(FLOW_REL_DIR, fileName)}.`,
    );
  }

  const parsedIssues = IssuesSchema.safeParse(parsedIssuesRaw);
  if (!parsedIssues.success) {
    throw new Error(
      `Deterministic validation error: issues schema mismatch in ${join(FLOW_REL_DIR, fileName)}.`,
    );
  }

  const issues = sortIssuesById(parsedIssues.data);
  const openIssues = issues.filter((issue) => issue.status === "open");

  if (openIssues.length === 0) {
    mergedDeps.logFn("No open issues to process. Exiting without changes.");
    return;
  }

  const skillTemplate = await mergedDeps.loadSkillFn(projectRoot, "automated-fix");
  const maxRetries = opts.retryOnFail ?? 0;

  let fixedCount = 0;
  let failedCount = 0;

  for (const issue of openIssues) {
    let retriesRemaining = maxRetries;

    while (true) {
      const prompt = buildPrompt(skillTemplate, {
        iteration,
        issue: JSON.stringify(issue, null, 2),
      });

      let result: AgentResult | null = null;
      let invocationError: unknown = null;

      try {
        result = await mergedDeps.invokeAgentFn({
          provider: opts.provider,
          prompt,
          cwd: projectRoot,
          interactive: false,
        });
      } catch (error) {
        invocationError = error;
      }

      if (invocationError) {
        if (isNetworkError(invocationError)) {
          issue.status = "manual-fix";
          await writeIssuesFile(issuesPath, issues, mergedDeps);

          const committed = await commitIssueUpdate(projectRoot, issue.id, issue.status, mergedDeps);
          if (!committed) {
            mergedDeps.logFn(`${issue.id}: Failed`);
            mergedDeps.logFn(`Error: git commit failed for ${issue.id}`);
          } else {
            mergedDeps.logFn(`${issue.id}: Failed`);
          }
          failedCount += 1;
          break;
        }

        if (retriesRemaining > 0) {
          retriesRemaining -= 1;
          issue.status = "retry";
          await writeIssuesFile(issuesPath, issues, mergedDeps);
          continue;
        }

        issue.status = "manual-fix";
        await writeIssuesFile(issuesPath, issues, mergedDeps);

        const committed = await commitIssueUpdate(projectRoot, issue.id, issue.status, mergedDeps);
        if (!committed) {
          mergedDeps.logFn(`${issue.id}: Failed`);
          mergedDeps.logFn(`Error: git commit failed for ${issue.id}`);
        } else {
          mergedDeps.logFn(`${issue.id}: Failed`);
        }

        failedCount += 1;
        break;
      }

      if (result === null) {
        throw new Error("Agent invocation produced no result.");
      }

      if (result.exitCode === 0) {
        issue.status = "fixed";
        await writeIssuesFile(issuesPath, issues, mergedDeps);

        const committed = await commitIssueUpdate(projectRoot, issue.id, issue.status, mergedDeps);
        if (!committed) {
          mergedDeps.logFn(`${issue.id}: Failed`);
          mergedDeps.logFn(`Error: git commit failed for ${issue.id}`);
          failedCount += 1;
        } else {
          mergedDeps.logFn(`${issue.id}: Fixed`);
          fixedCount += 1;
        }
        break;
      }

      if (isNetworkErrorText(`${result.stderr}\n${result.stdout}`)) {
        issue.status = "manual-fix";
        await writeIssuesFile(issuesPath, issues, mergedDeps);

        const committed = await commitIssueUpdate(projectRoot, issue.id, issue.status, mergedDeps);
        if (!committed) {
          mergedDeps.logFn(`${issue.id}: Failed`);
          mergedDeps.logFn(`Error: git commit failed for ${issue.id}`);
        } else {
          mergedDeps.logFn(`${issue.id}: Failed`);
        }
        failedCount += 1;
        break;
      }

      if (retriesRemaining > 0) {
        retriesRemaining -= 1;
        issue.status = "retry";
        await writeIssuesFile(issuesPath, issues, mergedDeps);
        continue;
      }

      issue.status = "manual-fix";
      await writeIssuesFile(issuesPath, issues, mergedDeps);

      const committed = await commitIssueUpdate(projectRoot, issue.id, issue.status, mergedDeps);
      if (!committed) {
        mergedDeps.logFn(`${issue.id}: Failed`);
        mergedDeps.logFn(`Error: git commit failed for ${issue.id}`);
      } else {
        mergedDeps.logFn(`${issue.id}: Failed`);
      }
      failedCount += 1;
      break;
    }
  }

  mergedDeps.logFn(`Summary: Fixed=${fixedCount} Failed=${failedCount}`);
  mergedDeps.logFn(`Processed ${openIssues.length} open issue(s) at ${mergedDeps.nowFn().toISOString()}`);
}
