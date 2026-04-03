import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";

import { CLI_COMMAND } from "../cli-path";
import { assertGuardrail } from "../guardrail";
import type { ReadLineFn } from "../guardrail";
import { defaultReadLine } from "../readline";
import { parsePrd } from "../prd-parser";
import { exists, readState, writeState, FLOW_REL_DIR } from "../state";

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

interface WriteJsonResult {
  exitCode: number;
  stderr: string;
}

interface ApproveRequirementDeps {
  existsFn: (path: string) => Promise<boolean>;
  invokeWriteJsonFn: (
    projectRoot: string,
    schemaName: string,
    outPath: string,
    data: string,
  ) => Promise<WriteJsonResult>;
  nowFn: () => Date;
  readFileFn: typeof readFile;
  readLineFn: ReadLineFn;
  stdoutWriteFn: (message: string) => void;
}

async function runWriteJsonCommand(
  projectRoot: string,
  schemaName: string,
  outPath: string,
  data: string,
): Promise<WriteJsonResult> {
  const result =
    await $`${CLI_COMMAND} write-json --schema ${schemaName} --out ${outPath} --data ${data}`
      .cwd(projectRoot)
      .nothrow()
      .quiet();

  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString().trim(),
  };
}

const defaultDeps: ApproveRequirementDeps = {
  existsFn: exists,
  invokeWriteJsonFn: runWriteJsonCommand,
  nowFn: () => new Date(),
  readFileFn: readFile,
  readLineFn: defaultReadLine,
  stdoutWriteFn: (message: string) => process.stdout.write(`${message}\n`),
};

export async function runApproveRequirement(
  optsOrDeps: { force?: boolean } | Partial<ApproveRequirementDeps> = {},
  maybeDeps: Partial<ApproveRequirementDeps> = {},
): Promise<void> {
  const isDepsArg =
    typeof optsOrDeps === "object"
    && optsOrDeps !== null
    && (
      "existsFn" in optsOrDeps
      || "invokeWriteJsonFn" in optsOrDeps
      || "nowFn" in optsOrDeps
      || "readFileFn" in optsOrDeps
      || "readLineFn" in optsOrDeps
      || "stdoutWriteFn" in optsOrDeps
    );
  const force = isDepsArg ? false : ((optsOrDeps as { force?: boolean }).force ?? false);
  const projectRoot = process.cwd();
  const state = await readState(projectRoot);
  const deps = isDepsArg ? optsOrDeps : maybeDeps;
  const mergedDeps: ApproveRequirementDeps = { ...defaultDeps, ...deps };

  // Collect all in_progress entries (AC01 / AC02)
  const requirementDefinitions = state.phases.define.requirement_definition;
  const inProgressEntries = requirementDefinitions.filter((e) => e.status === "in_progress");

  await assertGuardrail(
    state,
    inProgressEntries.length === 0,
    "Cannot approve requirement: no in_progress requirement definition found.",
    { force },
  );

  if (inProgressEntries.length === 0) return;

  // AC03: List all PRDs that will be approved
  mergedDeps.stdoutWriteFn("The following PRDs will be approved:");
  for (const entry of inProgressEntries) {
    mergedDeps.stdoutWriteFn(`  - ${entry.file ?? `entry #${entry.index}`}`);
  }

  // AC03: Confirmation prompt (skipped when force=true)
  if (!force) {
    mergedDeps.stdoutWriteFn("Proceed? [y/N]");
    let line: string | null;
    try {
      line = await mergedDeps.readLineFn();
    } catch {
      line = null;
    }
    if (!line || (line.trim() !== "y" && line.trim() !== "Y")) {
      mergedDeps.stdoutWriteFn("Aborted.");
      return;
    }
  }

  // AC01 / AC04: Approve each in_progress entry and generate PRD JSON
  let lastPrdJsonFileName: string | null = null;
  for (const entry of inProgressEntries) {
    const requirementFile = entry.file;
    if (!requirementFile) {
      throw new Error(`Cannot approve requirement entry #${entry.index}: file is missing.`);
    }

    const requirementPath = join(projectRoot, FLOW_REL_DIR, requirementFile);
    if (!(await mergedDeps.existsFn(requirementPath))) {
      throw new Error(`Cannot approve requirement: file not found at ${requirementPath}`);
    }

    const markdown = await mergedDeps.readFileFn(requirementPath, "utf-8");
    const prdData = parsePrd(markdown);
    const prdJsonFileName = `it_${state.current_iteration}_PRD.json`;
    const prdJsonRelPath = join(FLOW_REL_DIR, prdJsonFileName);

    const result = await mergedDeps.invokeWriteJsonFn(
      projectRoot,
      "prd",
      prdJsonRelPath,
      JSON.stringify(prdData),
    );

    if (result.exitCode !== 0) {
      const stderr = result.stderr.trim();
      console.error(`PRD JSON generation failed for ${requirementFile}. Requirement remains in_progress.`);
      if (stderr) {
        console.error(stderr);
      }
      process.exitCode = 1;
      return;
    }

    entry.status = "approved";
    lastPrdJsonFileName = prdJsonFileName;
  }

  // AC04: Persist state with all entries marked approved
  if (lastPrdJsonFileName) {
    state.phases.define.prd_generation.status = "completed";
    state.phases.define.prd_generation.file = lastPrdJsonFileName;
  }

  state.last_updated = mergedDeps.nowFn().toISOString();
  state.updated_by = "nvst:approve-requirement";

  await writeState(projectRoot, state);

  const prdRelPath = join(FLOW_REL_DIR, lastPrdJsonFileName!);
  mergedDeps.stdoutWriteFn(`All ${inProgressEntries.length} requirement(s) approved.`);
  mergedDeps.stdoutWriteFn(`PRD JSON written to ${prdRelPath}`);
}
