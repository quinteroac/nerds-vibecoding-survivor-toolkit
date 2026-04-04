import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { $ as dollar } from "bun";

import type { State } from "../schemas/tmpl_state";
import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentInvokeOptions,
  type AgentResult,
} from "../agent";
import { assertGuardrail } from "../guardrail";
import { defaultReadLine } from "../readline";
import { exists, FLOW_REL_DIR, readState, writeState } from "../state";
import { extractPrdTitle, runGitAddAndCommit } from "./create-prototype";

export const NVST_PR_FOOTER =
  "---\n_Made with [NVST](https://github.com/NerdsVibe/nerds-vibecoding-survivor-toolkit)_";

export const CHANGELOG_HEADER = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---`;

/** Extracts `- item` lines from a Goals section block (including the `## Goals` heading). */
export function extractGoalBullets(goalsSection: string): string[] {
  return goalsSection
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "));
}

/**
 * Builds a merged CHANGELOG bullets list from multiple PRDs.
 * When multiple PRDs contribute goals, each PRD's goal bullets are prefixed with
 * the PRD index and title, e.g. `- **PRD 001 — My Title:** Original goal text`.
 * When only a single PRD is present, bullets are returned in their original form.
 */
export function buildMultiPrdChangelogBullets(
  prdEntries: Array<{ index: number; title: string | null; goals: string | null }>,
): string[] {
  const withBullets = prdEntries.filter(
    (e) => e.goals && extractGoalBullets(e.goals).length > 0,
  );
  const usePrefix = withBullets.length > 1;
  const allBullets: string[] = [];
  for (const { index, title, goals } of prdEntries) {
    if (!goals) continue;
    const bullets = extractGoalBullets(goals);
    if (bullets.length === 0) continue;
    if (usePrefix) {
      const prdLabel = title
        ? `**PRD ${String(index).padStart(3, "0")} — ${title}:**`
        : `**PRD ${String(index).padStart(3, "0")}:**`;
      for (const bullet of bullets) {
        const bulletText = bullet.replace(/^-\s*/, "");
        allBullets.push(`- ${prdLabel} ${bulletText}`);
      }
    } else {
      allBullets.push(...bullets);
    }
  }
  return allBullets;
}

/** Builds a Keep a Changelog entry for one iteration. */
export function buildChangelogEntry(
  iteration: string,
  isoDate: string,
  bullets: string[],
): string {
  const bulletLines = bullets.join("\n");
  return `## [${iteration}] - ${isoDate}\n\n### Added\n${bulletLines}`;
}

/**
 * Inserts a new changelog entry into existing CHANGELOG.md content.
 * The entry is placed after the header block and before any existing `## [` entry,
 * so the most recent iteration always appears first.
 * Skips insertion if an entry with the same heading already exists (duplicate guard).
 */
export function insertChangelogEntry(existingContent: string, newEntry: string): string {
  const normalized = existingContent.replace(/\r\n/g, "\n");

  // Extract the heading line of the new entry (e.g. "## [000041] - 2026-04-01")
  const newHeading = newEntry.split("\n")[0];
  if (normalized.includes(newHeading)) {
    return normalized;
  }

  const match = /^## \[/m.exec(normalized);

  if (!match) {
    return normalized.trimEnd() + "\n\n" + newEntry + "\n";
  }

  const before = normalized.slice(0, match.index).trimEnd();
  const after = normalized.slice(match.index);
  return before + "\n\n" + newEntry + "\n\n" + after;
}

/**
 * Extracts a named `## Section` block (heading + body) from PRD markdown content.
 * Returns the trimmed section text, or null if the section is absent.
 */
export function extractPrdSection(content: string, sectionName: string): string | null {
  const normalizedContent = content.replace(/\r\n/g, "\n");
  const lines = normalizedContent.split("\n");
  let inSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    if (!inSection && line.trimEnd() === `## ${sectionName}`) {
      inSection = true;
      sectionLines.push(line);
      continue;
    }
    if (inSection) {
      if (/^##\s/.test(line)) {
        break;
      }
      sectionLines.push(line);
    }
  }

  if (!inSection) return null;

  while (sectionLines.length > 0 && sectionLines[sectionLines.length - 1].trim() === "") {
    sectionLines.pop();
  }

  return sectionLines.length > 0 ? sectionLines.join("\n") : null;
}

/**
 * Extracts the title, Context section, and Goals section from PRD markdown content.
 * Satisfies FR-2: single exported helper for unit testability.
 */
export function extractPrdSections(markdown: string): {
  title: string | null;
  context: string | null;
  goals: string | null;
} {
  return {
    title: extractPrdTitle(markdown),
    context: extractPrdSection(markdown, "Context"),
    goals: extractPrdSection(markdown, "Goals"),
  };
}

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
  gitAddAndCommitFn: (projectRoot: string, commitMessage: string) => Promise<void>;
  getCurrentBranchFn: (projectRoot: string) => Promise<string>;
  gitPushFn: (projectRoot: string, branch: string) => Promise<void>;
  checkGhAvailableFn: (projectRoot: string) => Promise<boolean>;
  createPullRequestFn: (
    projectRoot: string,
    title: string,
    body: string,
  ) => Promise<{ exitCode: number; stderr: string }>;
  warnFn: (message: string) => void;
  writeStateFn: (projectRoot: string, state: State) => Promise<void>;
  readPrdMarkdownFn: (path: string) => Promise<string | null>;
  readChangelogFn: (path: string) => Promise<string | null>;
  writeChangelogFn: (path: string, content: string) => Promise<void>;
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
  gitAddAndCommitFn: runGitAddAndCommit,
  getCurrentBranchFn: async (projectRoot: string): Promise<string> => {
    const branchResult = await dollar`git rev-parse --abbrev-ref HEAD`
      .cwd(projectRoot)
      .nothrow()
      .quiet();

    if (branchResult.exitCode !== 0) {
      const reason = branchResult.stderr.toString().trim() || branchResult.stdout.toString().trim();
      throw new Error(
        `Failed to determine current git branch for push.${reason ? ` Reason: ${reason}` : ""}`,
      );
    }

    const branch = branchResult.stdout.toString().trim();
    if (!branch) {
      throw new Error("Failed to determine current git branch for push: empty branch name.");
    }

    return branch;
  },
  gitPushFn: async (projectRoot: string, branch: string): Promise<void> => {
    const pushResult = await dollar`git push --set-upstream origin ${branch}`
      .cwd(projectRoot)
      .nothrow()
      .quiet();

    if (pushResult.exitCode !== 0) {
      const details = pushResult.stderr.toString().trim() || pushResult.stdout.toString().trim();
      throw new Error(
        `Git push failed for branch '${branch}'${details ? `: ${details}` : "."}`,
      );
    }
  },
  checkGhAvailableFn: async (projectRoot: string) => {
    const proc = Bun.spawn(["gh", "--version"], {
      cwd: projectRoot,
      stdout: "ignore",
      stderr: "ignore",
    });
    return (await proc.exited) === 0;
  },
  createPullRequestFn: async (projectRoot, title, body) => {
    const result = await dollar`gh pr create --title ${title} --body ${body}`
      .cwd(projectRoot)
      .nothrow()
      .quiet();
    return {
      exitCode: result.exitCode,
      stderr: result.stderr.toString().trim(),
    };
  },
  warnFn: console.warn,
  writeStateFn: writeState,
  readPrdMarkdownFn: async (path: string) => {
    try {
      return await readFile(path, "utf8");
    } catch {
      return null;
    }
  },
  readChangelogFn: async (path: string) => {
    try {
      return await readFile(path, "utf8");
    } catch {
      return null;
    }
  },
  writeChangelogFn: async (path: string, content: string) => {
    await Bun.write(path, content);
  },
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

  // Check state arrays for multi-PRD completion (RP-2)
  // Normalise: handle both the new array format and legacy single-object format (not going through Zod).
  const rawAudit = state.phases.prototype?.prototype_audit;
  const auditEntries = Array.isArray(rawAudit) ? rawAudit : [];
  const rawRefactor = state.phases.prototype?.prototype_refactor;
  const refactorEntries = Array.isArray(rawRefactor) ? rawRefactor : [];
  const auditCompletedViaState =
    auditEntries.length > 0 && auditEntries.every((e) => e.status === "completed");
  const refactorCompletedViaState =
    refactorEntries.length > 0 && refactorEntries.every((e) => e.status === "completed");

  const effectiveHasAudit = hasAuditMd || hasAuditJson || auditCompletedViaState;
  const effectiveHasRefactor = hasRefactorReport || refactorCompletedViaState;

  let violated = false;
  let message = "";

  if (!effectiveHasAudit && !effectiveHasRefactor) {
    violated = true;
    message = AUDIT_MISSING_MESSAGE;
  } else if ((hasAuditJson || auditCompletedViaState) && !effectiveHasRefactor) {
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

  // Read all PRDs from requirement_definition array (US-008-AC01)
  const reqDefs = state.phases.define?.requirement_definition ?? [];
  const sortedReqDefs = [...reqDefs].sort((a, b) => a.index - b.index);
  const allPrdContents: Array<{ index: number; content: string }> = (
    await Promise.all(
      sortedReqDefs
        .filter((e) => e.file !== null)
        .map(async (e) => {
          const content = await mergedDeps.readPrdMarkdownFn(join(flowDir, e.file!));
          return content !== null ? { index: e.index, content } : null;
        }),
    )
  ).filter((x): x is { index: number; content: string } => x !== null);

  // Legacy fallback: if no PRD entries in the array, try the single-PRD naming convention
  if (allPrdContents.length === 0) {
    const legacyPrdPath = join(flowDir, `it_${iteration}_product-requirement-document.md`);
    const legacyContent = await mergedDeps.readPrdMarkdownFn(legacyPrdPath);
    if (legacyContent !== null) {
      allPrdContents.push({ index: 1, content: legacyContent });
    }
  }

  // Append iteration goals to CHANGELOG.md (US-008-AC02)
  const changelogPath = join(projectRoot, "CHANGELOG.md");
  if (allPrdContents.length === 0) {
    mergedDeps.warnFn(
      `Skipping changelog update: no PRD files found for iteration ${iteration}.`,
    );
  } else {
    const prdGoalEntries = allPrdContents.map(({ index, content }) => ({
      index,
      title: extractPrdTitle(content),
      goals: extractPrdSection(content, "Goals"),
    }));
    const bullets = buildMultiPrdChangelogBullets(prdGoalEntries);
    if (bullets.length === 0) {
      mergedDeps.warnFn(
        "Skipping changelog update: no ## Goals bullet items found in any PRD.",
      );
    } else {
      const isoDate = new Date().toISOString().slice(0, 10);
      const entry = buildChangelogEntry(iteration, isoDate, bullets);
      const existingChangelog = await mergedDeps.readChangelogFn(changelogPath);
      const updatedContent =
        existingChangelog !== null
          ? insertChangelogEntry(existingChangelog, entry)
          : CHANGELOG_HEADER + "\n\n" + entry + "\n";
      await mergedDeps.writeChangelogFn(changelogPath, updatedContent);
    }
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

  const nextState: State = {
    ...state,
    phases: {
      ...state.phases,
      prototype: {
        ...state.phases.prototype,
        prototype_approval: {
          status: "completed",
          file: null,
        },
      },
    },
    last_updated: new Date().toISOString(),
    updated_by: "nvst:approve-prototype",
  };

  await mergedDeps.writeStateFn(projectRoot, nextState);

  const commitMessage = `feat: approve iteration ${iteration} prototype`;
  await mergedDeps.gitAddAndCommitFn(projectRoot, commitMessage);

  const branch = await mergedDeps.getCurrentBranchFn(projectRoot);
  await mergedDeps.gitPushFn(projectRoot, branch);

  const ghAvailable = await mergedDeps.checkGhAvailableFn(projectRoot);
  if (!ghAvailable) {
    mergedDeps.warnFn(
      "GitHub CLI (gh) not found. Skipping PR creation. Push was successful.",
    );
  } else {
    // Derive PR title from first PRD's title (US-008-AC03)
    let requirementName = `approve prototype iteration it_${iteration}`;
    if (allPrdContents.length > 0) {
      const firstTitle = extractPrdTitle(allPrdContents[0].content);
      if (firstTitle) {
        requirementName = firstTitle;
      } else {
        mergedDeps.warnFn(
          "Unable to derive PR title from markdown PRD: no `# Requirement:` heading found.",
        );
      }
    } else {
      mergedDeps.warnFn(
        `Unable to derive PR title from markdown PRD: no PRD files found for iteration ${iteration}.`,
      );
    }

    // Derive refactor report path(s) from state.phases.prototype.prototype_refactor (RP-3)
    const rawRefactorState = state.phases.prototype?.prototype_refactor;
    const refactorStateEntries = Array.isArray(rawRefactorState) ? rawRefactorState : [];
    const refactorFilePaths = refactorStateEntries
      .filter((e) => e.file !== null)
      .map((e) => join(FLOW_REL_DIR, e.file!));
    const refactorReportRelativePath =
      refactorFilePaths.length > 0
        ? refactorFilePaths.join(", ")
        : join(FLOW_REL_DIR, `it_${iteration}_refactor-report.md`);
    const prTitle = `feat: it_${iteration} — ${requirementName}`;

    // Build PR body from all PRDs (US-008-AC03)
    const bodySections: string[] = [];
    for (const { content } of allPrdContents) {
      const title = extractPrdTitle(content);
      const contextSection = extractPrdSection(content, "Context");
      const goalsSection = extractPrdSection(content, "Goals");
      if (title) bodySections.push(title);
      if (contextSection) bodySections.push(contextSection);
      if (goalsSection) bodySections.push(goalsSection);
    }
    bodySections.push(`Refactor report: ${refactorReportRelativePath}`);
    bodySections.push(NVST_PR_FOOTER);
    const prBody = bodySections.join("\n\n");

    const prResult = await mergedDeps.createPullRequestFn(projectRoot, prTitle, prBody);
    if (prResult.exitCode !== 0) {
      const suffix = prResult.stderr.length > 0 ? `: ${prResult.stderr}` : "";
      mergedDeps.warnFn(`gh pr create failed (non-fatal)${suffix}`);
    }
  }
}
