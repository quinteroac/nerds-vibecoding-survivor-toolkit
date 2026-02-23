import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

import {
  invokeAgent,
  type AgentInvokeOptions,
  type AgentProvider,
  type AgentResult,
} from "../agent";
import { exists, FLOW_REL_DIR, readState } from "../state";
import { IssuesSchema, type Issue } from "../../scaffold/schemas/tmpl_issues";

export interface ExecuteManualFixOptions {
  provider: AgentProvider;
}

interface ExecuteManualFixDeps {
  existsFn: (path: string) => Promise<boolean>;
  invokeAgentFn: (options: AgentInvokeOptions) => Promise<AgentResult>;
  logFn: (message: string) => void;
  promptProceedFn: (question: string) => Promise<boolean>;
  readFileFn: typeof readFile;
}

const defaultDeps: ExecuteManualFixDeps = {
  existsFn: exists,
  invokeAgentFn: invokeAgent,
  logFn: console.log,
  promptProceedFn: promptForConfirmation,
  readFileFn: readFile,
};

export function buildManualFixGuidancePrompt(issue: Issue, iteration: string): string {
  return `You are helping a developer resolve one manual-fix issue.

Issue context:
- Iteration: ${iteration}
- Issue ID: ${issue.id}
- Title: ${issue.title}
- Description:
${issue.description}

Response requirements:
1. Start with a concise summary/analysis of the problem.
2. Suggest a concrete reproduction strategy or test case.
3. Suggest potential fixes or code changes with rationale.
4. After the initial guidance, continue in an interactive chat loop:
   - Answer clarifying questions.
   - Provide code snippets when requested.
   - Keep working on this issue until the user says they are done.
5. Do not switch to other issues in this session.`;
}

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

  for (const [index, issue] of manualFixIssues.entries()) {
    mergedDeps.logFn(
      `Issue ${index + 1}/${manualFixIssues.length}: ${issue.id} - ${issue.title}`,
    );

    const prompt = buildManualFixGuidancePrompt(issue, iteration);
    const result = await mergedDeps.invokeAgentFn({
      provider: opts.provider,
      prompt,
      cwd: projectRoot,
      interactive: true,
    });

    if (result.exitCode !== 0) {
      throw new Error(
        `Agent invocation failed while guiding issue ${issue.id} with exit code ${result.exitCode}.`,
      );
    }
  }
}
