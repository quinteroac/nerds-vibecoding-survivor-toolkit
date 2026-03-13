import { join } from "node:path";
import { $ as dollar } from "bun";

import type { State } from "../../scaffold/schemas/tmpl_state";
import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentInvokeOptions,
  type AgentResult,
} from "../agent";
import { assertGuardrail } from "../guardrail";
import { defaultReadLine } from "../readline";
import { exists, FLOW_REL_DIR, readState } from "../state";

export interface ApprovePrototypeOptions {
  force?: boolean;
}

interface ApprovePrototypeDeps {
  existsFn: (path: string) => Promise<boolean>;
  logFn: (message: string) => void;
  readStateFn: (projectRoot: string) => Promise<State>;
  loadSkillFn: (projectRoot: string, skillName: string) => Promise<string>;
  invokeAgentFn: (options: AgentInvokeOptions) => Promise<AgentResult>;
  readChangedFilesFn: (projectRoot: string) => Promise<string[]>;
  promptGitOpsConfirmationFn: (files: string[]) => Promise<boolean>;
}

const defaultDeps: ApprovePrototypeDeps = {
  existsFn: exists,
  logFn: console.warn,
  readStateFn: readState,
  loadSkillFn: loadSkill,
  invokeAgentFn: invokeAgent,
  readChangedFilesFn: readChangedFiles,
  promptGitOpsConfirmationFn: (files) =>
    promptForGitOperationsConfirmation(files, defaultReadLine, defaultStdoutWrite, defaultIsTTY),
};

type ReadLineFn = () => Promise<string | null>;
type WriteFn = (message: string) => void;
type IsTTYFn = () => boolean;

function defaultStdoutWrite(message: string): void {
  process.stdout.write(`${message}\n`);
}

function defaultIsTTY(): boolean {
  return process.stdin.isTTY === true;
}

export function buildGitOpsConfirmationPrompt(files: string[]): string {
  const fileList = files.join(", ");
  return `The agent updated: ${fileList}. Proceed with commit, push, and PR creation? [y/N]`;
}

export async function promptForGitOperationsConfirmation(
  files: string[],
  readLineFn: ReadLineFn,
  writeFn: WriteFn,
  isTTYFn: IsTTYFn,
): Promise<boolean> {
  if (!isTTYFn()) {
    return false;
  }

  const prompt = buildGitOpsConfirmationPrompt(files);
  writeFn(prompt);

  let line: string | null;
  try {
    line = await readLineFn();
  } catch {
    line = null;
  }

  if (line === null) {
    return false;
  }

  const trimmed = line.trim();
  if (trimmed === "y" || trimmed === "Y") {
    return true;
  }

  writeFn("Aborted. No git operations performed.");
  return false;
}

async function readChangedFiles(projectRoot: string): Promise<string[]> {
  const result = await dollar`git status --porcelain`
    .cwd(projectRoot)
    .nothrow()
    .quiet();

  if (result.exitCode !== 0) {
    return [];
  }

  const stdout = result.stdout.toString().trim();
  if (!stdout) {
    return [];
  }

  return stdout
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter((path) => path.length > 0);
}

const AUDIT_MISSING_MESSAGE =
  "Cannot approve prototype: audit prototype has not been run for this iteration.";

const REFACTOR_NOT_RUN_MESSAGE =
  "Cannot approve prototype: a refactor plan exists but refactor prototype has not been run. Run `nvst refactor prototype` first.";

export async function runApprovePrototype(
  opts: ApprovePrototypeOptions = {},
  deps: Partial<ApprovePrototypeDeps> = {},
): Promise<void> {
  const mergedDeps = { ...defaultDeps, ...deps };
  const projectRoot = process.cwd();
  const state = await mergedDeps.readStateFn(projectRoot);
  const force = opts.force ?? false;

  const iteration = state.current_iteration;
  const flowDir = join(projectRoot, FLOW_REL_DIR);

  const auditMdPath = join(flowDir, `it_${iteration}_audit.md`);
  const auditJsonPath = join(flowDir, `it_${iteration}_audit.json`);
  const refactorReportPath = join(flowDir, `it_${iteration}_refactor-report.md`);

  const [hasAuditMd, hasAuditJson, hasRefactorReport] = await Promise.all([
    mergedDeps.existsFn(auditMdPath),
    mergedDeps.existsFn(auditJsonPath),
    mergedDeps.existsFn(refactorReportPath),
  ]);

  let violated = false;
  let message = "";

  if (!hasAuditMd && !hasRefactorReport) {
    violated = true;
    message = AUDIT_MISSING_MESSAGE;
  } else if (hasAuditJson && !hasRefactorReport) {
    violated = true;
    message = REFACTOR_NOT_RUN_MESSAGE;
  }

  await assertGuardrail(state, violated, message, { force });

  const skillBody = await mergedDeps.loadSkillFn(projectRoot, "approve-prototype");
  const prompt = buildPrompt(skillBody, {
    iteration,
  });
  const result = await mergedDeps.invokeAgentFn({
    provider: "ide",
    prompt,
    cwd: projectRoot,
    interactive: true,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Agent invocation failed with exit code ${result.exitCode}.`);
  }

  const changedFiles = await mergedDeps.readChangedFilesFn(projectRoot);
  if (changedFiles.length === 0) {
    return;
  }

  const shouldProceed = await mergedDeps.promptGitOpsConfirmationFn(changedFiles);
  if (!shouldProceed) {
    mergedDeps.logFn("Aborted. No git operations performed.");
    return;
  }
}
