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
import { type Issue } from "../../scaffold/schemas/tmpl_issues";

export interface ExecuteAutomatedFixOptions {
  provider: AgentProvider;
  iterations?: number;
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

const ALLOWED_ISSUE_STATUSES: Set<Issue["status"]> = new Set([
  "open",
  "fixed",
  "retry",
  "manual-fix",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseIssuesForProcessing(
  raw: unknown,
  flowRelativePath: string,
  logFn: (message: string) => void,
): Issue[] {
  if (!Array.isArray(raw)) {
    throw new Error(
      `Deterministic validation error: issues schema mismatch in ${flowRelativePath}.`,
    );
  }

  const parsedIssues: Issue[] = [];
  const seenIds = new Set<string>();

  for (const [index, item] of raw.entries()) {
    const issue = asRecord(item);
    if (!issue) {
      logFn(
        `Warning: Skipping invalid issue at index ${index} in ${flowRelativePath}: expected an object.`,
      );
      continue;
    }

    const id = issue.id;
    const title = issue.title;
    const description = issue.description;
    const status = issue.status;

    const missingFields: string[] = [];
    if (typeof id !== "string") {
      missingFields.push("id");
    }
    if (typeof title !== "string") {
      missingFields.push("title");
    }
    if (typeof description !== "string") {
      missingFields.push("description");
    }
    if (typeof status !== "string") {
      missingFields.push("status");
    }

    if (missingFields.length > 0) {
      logFn(
        `Warning: Skipping issue at index ${index} in ${flowRelativePath}: missing required field(s): ${missingFields.join(", ")}.`,
      );
      continue;
    }

    const validId = id as string;
    const validTitle = title as string;
    const validDescription = description as string;
    const validStatus = status as Issue["status"];

    if (!ALLOWED_ISSUE_STATUSES.has(validStatus)) {
      logFn(
        `Warning: Skipping issue ${validId} in ${flowRelativePath}: invalid status '${status}'.`,
      );
      continue;
    }

    if (seenIds.has(validId)) {
      logFn(
        `Warning: Skipping duplicate issue id '${validId}' in ${flowRelativePath}.`,
      );
      continue;
    }

    seenIds.add(validId);
    parsedIssues.push({
      id: validId,
      title: validTitle,
      description: validDescription,
      status: validStatus,
    });
  }

  return parsedIssues;
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
  if (opts.iterations !== undefined && (!Number.isInteger(opts.iterations) || opts.iterations < 1)) {
    throw new Error("Invalid --iterations value. Expected an integer >= 1.");
  }

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
  const flowRelativePath = join(FLOW_REL_DIR, fileName);
  try {
    parsedIssuesRaw = JSON.parse(await mergedDeps.readFileFn(issuesPath, "utf8"));
  } catch {
    throw new Error(
      `Deterministic validation error: invalid issues JSON in ${flowRelativePath}.`,
    );
  }

  const issues = sortIssuesById(parseIssuesForProcessing(parsedIssuesRaw, flowRelativePath, mergedDeps.logFn));
  const openIssues = issues.filter((issue) => issue.status === "open");

  if (openIssues.length === 0) {
    mergedDeps.logFn("No open issues to process. Exiting without changes.");
    return;
  }

  const skillTemplate = await mergedDeps.loadSkillFn(projectRoot, "automated-fix");
  const maxIssuesToProcess = opts.iterations ?? openIssues.length;
  const issuesToProcess = openIssues.slice(0, maxIssuesToProcess);
  const maxRetries = opts.retryOnFail ?? 0;

  let fixedCount = 0;
  let failedCount = 0;

  for (const issue of issuesToProcess) {
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
  mergedDeps.logFn(`Processed ${issuesToProcess.length} open issue(s) at ${mergedDeps.nowFn().toISOString()}`);
}
