import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

import { type AgentProvider } from "../agent";
import { exists, FLOW_REL_DIR, readState } from "../state";
import { IssuesSchema, type Issue } from "../../scaffold/schemas/tmpl_issues";

export interface ExecuteManualFixOptions {
  provider: AgentProvider;
}

interface ExecuteManualFixDeps {
  existsFn: (path: string) => Promise<boolean>;
  logFn: (message: string) => void;
  promptProceedFn: (question: string) => Promise<boolean>;
  readFileFn: typeof readFile;
}

const defaultDeps: ExecuteManualFixDeps = {
  existsFn: exists,
  logFn: console.log,
  promptProceedFn: promptForConfirmation,
  readFileFn: readFile,
};

export async function promptForConfirmation(question: string): Promise<boolean> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = (await readline.question(question)).trim();
    return /^y(?:es)?$/i.test(answer);
  } finally {
    readline.close();
  }
}

export async function runExecuteManualFix(
  opts: ExecuteManualFixOptions,
  deps: Partial<ExecuteManualFixDeps> = {},
): Promise<void> {
  const mergedDeps: ExecuteManualFixDeps = { ...defaultDeps, ...deps };
  const projectRoot = process.cwd();
  const state = await readState(projectRoot);

  const iteration = state.current_iteration;
  const fileName = `it_${iteration}_ISSUES.json`;
  const issuesPath = join(projectRoot, FLOW_REL_DIR, fileName);
  const flowRelativePath = join(FLOW_REL_DIR, fileName);

  if (!(await mergedDeps.existsFn(issuesPath))) {
    throw new Error(
      `Issues file not found: expected ${flowRelativePath}. Run \`bun nvst create issue --agent <provider>\` first.`,
    );
  }

  let parsedIssuesRaw: unknown;
  try {
    parsedIssuesRaw = JSON.parse(await mergedDeps.readFileFn(issuesPath, "utf8"));
  } catch {
    throw new Error(
      `Deterministic validation error: invalid issues JSON in ${flowRelativePath}.`,
    );
  }

  const validation = IssuesSchema.safeParse(parsedIssuesRaw);
  if (!validation.success) {
    throw new Error(
      `Deterministic validation error: issues schema mismatch in ${flowRelativePath}.`,
    );
  }

  const manualFixIssues = validation.data.filter((issue: Issue) => issue.status === "manual-fix");
  mergedDeps.logFn(
    `Found ${manualFixIssues.length} issue(s) with status 'manual-fix' in ${flowRelativePath}.`,
  );

  const proceed = await mergedDeps.promptProceedFn(
    `Proceed with manual-fix processing for ${manualFixIssues.length} issue(s) using '${opts.provider}'? [y/N] `,
  );
  if (!proceed) {
    mergedDeps.logFn("Manual-fix execution cancelled.");
    return;
  }

  if (manualFixIssues.length === 0) {
    mergedDeps.logFn("No manual-fix issues to process. Exiting without changes.");
    return;
  }

  mergedDeps.logFn(`Ready to process ${manualFixIssues.length} manual-fix issue(s).`);
}
