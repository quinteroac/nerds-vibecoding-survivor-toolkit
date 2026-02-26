import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

import { RefactorPrdSchema } from "../../scaffold/schemas/tmpl_refactor-prd";
import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentInvokeOptions,
  type AgentProvider,
  type AgentResult,
} from "../agent";
import { exists, FLOW_REL_DIR, readState, writeState } from "../state";

export interface ExecuteRefactorOptions {
  provider: AgentProvider;
}

const RefactorExecutionEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["pending", "completed", "failed"]),
  agent_exit_code: z.number().int().nullable(),
  updated_at: z.string(),
});

export const RefactorExecutionProgressSchema = z.object({
  entries: z.array(RefactorExecutionEntrySchema),
});

export type RefactorExecutionProgress = z.infer<typeof RefactorExecutionProgressSchema>;

interface ExecuteRefactorDeps {
  existsFn: (path: string) => Promise<boolean>;
  invokeAgentFn: (options: AgentInvokeOptions) => Promise<AgentResult>;
  loadSkillFn: (projectRoot: string, skillName: string) => Promise<string>;
  logFn: (message: string) => void;
  nowFn: () => Date;
  readFileFn: typeof readFile;
  writeFileFn: typeof writeFile;
}

const defaultDeps: ExecuteRefactorDeps = {
  existsFn: exists,
  invokeAgentFn: invokeAgent,
  loadSkillFn: loadSkill,
  logFn: console.log,
  nowFn: () => new Date(),
  readFileFn: readFile,
  writeFileFn: writeFile,
};

export async function runExecuteRefactor(
  opts: ExecuteRefactorOptions,
  deps: Partial<ExecuteRefactorDeps> = {},
): Promise<void> {
  const mergedDeps: ExecuteRefactorDeps = { ...defaultDeps, ...deps };
  const projectRoot = process.cwd();
  const state = await readState(projectRoot);

  // AC02: Reject if current_phase !== "refactor"
  if (state.current_phase !== "refactor") {
    throw new Error(
      `Cannot execute refactor: current_phase must be 'refactor'. Current phase: '${state.current_phase}'.`,
    );
  }

  // AC03: Reject if refactor_plan.status !== "approved"
  if (state.phases.refactor.refactor_plan.status !== "approved") {
    throw new Error(
      `Cannot execute refactor: refactor_plan.status must be 'approved'. Current status: '${state.phases.refactor.refactor_plan.status}'. Run \`bun nvst approve refactor-plan\` first.`,
    );
  }

  // AC04: Reject if refactor_execution.status is already "completed"
  if (state.phases.refactor.refactor_execution.status === "completed") {
    throw new Error(
      "Cannot execute refactor: refactor_execution.status is already 'completed'.",
    );
  }

  // AC05: Read and validate refactor-prd.json
  const iteration = state.current_iteration;
  const refactorPrdFileName = `it_${iteration}_refactor-prd.json`;
  const refactorPrdPath = join(projectRoot, FLOW_REL_DIR, refactorPrdFileName);

  if (!(await mergedDeps.existsFn(refactorPrdPath))) {
    throw new Error(
      `Refactor PRD file missing: expected ${join(FLOW_REL_DIR, refactorPrdFileName)}. Run \`bun nvst approve refactor-plan\` first.`,
    );
  }

  let parsedPrd: unknown;
  try {
    parsedPrd = JSON.parse(await mergedDeps.readFileFn(refactorPrdPath, "utf8"));
  } catch {
    throw new Error(
      `Invalid refactor PRD JSON in ${join(FLOW_REL_DIR, refactorPrdFileName)}.`,
    );
  }

  const prdValidation = RefactorPrdSchema.safeParse(parsedPrd);
  if (!prdValidation.success) {
    throw new Error(
      `Refactor PRD schema mismatch in ${join(FLOW_REL_DIR, refactorPrdFileName)}.`,
    );
  }

  const refactorItems = prdValidation.data.refactorItems;

  // Load skill
  let skillTemplate: string;
  try {
    skillTemplate = await mergedDeps.loadSkillFn(projectRoot, "execute-refactor-item");
  } catch {
    throw new Error(
      "Required skill missing: expected .agents/skills/execute-refactor-item/SKILL.md.",
    );
  }

  // AC13: Progress file name
  const progressFileName = `it_${iteration}_refactor-execution-progress.json`;
  const progressPath = join(projectRoot, FLOW_REL_DIR, progressFileName);

  // AC06: Set refactor_execution.status = "in_progress" before processing
  // AC13: Set refactor_execution.file
  state.phases.refactor.refactor_execution.status = "in_progress";
  state.phases.refactor.refactor_execution.file = progressFileName;
  state.last_updated = mergedDeps.nowFn().toISOString();
  state.updated_by = "nvst:execute-refactor";
  await writeState(projectRoot, state);

  // Initialize or load progress file
  let progressData: RefactorExecutionProgress;

  if (await mergedDeps.existsFn(progressPath)) {
    let parsedProgress: unknown;
    try {
      parsedProgress = JSON.parse(await mergedDeps.readFileFn(progressPath, "utf8"));
    } catch {
      throw new Error(
        `Invalid progress JSON in ${join(FLOW_REL_DIR, progressFileName)}.`,
      );
    }

    const progressValidation = RefactorExecutionProgressSchema.safeParse(parsedProgress);
    if (!progressValidation.success) {
      throw new Error(
        `Progress schema mismatch in ${join(FLOW_REL_DIR, progressFileName)}.`,
      );
    }
    progressData = progressValidation.data;
  } else {
    const now = mergedDeps.nowFn().toISOString();
    progressData = {
      entries: refactorItems.map((item) => ({
        id: item.id,
        title: item.title,
        status: "pending" as const,
        agent_exit_code: null,
        updated_at: now,
      })),
    };
    await mergedDeps.writeFileFn(
      progressPath,
      `${JSON.stringify(progressData, null, 2)}\n`,
      "utf8",
    );
  }

  // AC07, AC08, AC09, AC10: Process each item in order
  for (const item of refactorItems) {
    const entry = progressData.entries.find((e) => e.id === item.id);
    if (!entry || entry.status === "completed") {
      continue;
    }

    // AC07: Build prompt with skill and item context
    const prompt = buildPrompt(skillTemplate, {
      iteration,
      refactor_item_id: item.id,
      refactor_item_title: item.title,
      refactor_item_description: item.description,
      refactor_item_rationale: item.rationale,
    });

    // AC08: Invoke agent in interactive mode
    const agentResult = await mergedDeps.invokeAgentFn({
      provider: opts.provider,
      prompt,
      cwd: projectRoot,
      interactive: true,
    });

    // AC09 & AC10: Record result after each invocation, continue on failure
    const succeeded = agentResult.exitCode === 0;
    entry.status = succeeded ? "completed" : "failed";
    entry.agent_exit_code = agentResult.exitCode;
    entry.updated_at = mergedDeps.nowFn().toISOString();

    await mergedDeps.writeFileFn(
      progressPath,
      `${JSON.stringify(progressData, null, 2)}\n`,
      "utf8",
    );

    mergedDeps.logFn(
      `iteration=it_${iteration} item=${item.id} outcome=${entry.status}`,
    );
  }

  // AC11 & AC12: Update state based on overall result
  const allCompleted = progressData.entries.every((entry) => entry.status === "completed");

  if (allCompleted) {
    // AC11: All completed → set status to "completed"
    state.phases.refactor.refactor_execution.status = "completed";
  }
  // AC12: Any failure → stays "in_progress" (already set above)

  state.last_updated = mergedDeps.nowFn().toISOString();
  state.updated_by = "nvst:execute-refactor";
  await writeState(projectRoot, state);

  if (allCompleted) {
    mergedDeps.logFn("Refactor execution completed for all items.");
  } else {
    mergedDeps.logFn("Refactor execution paused with remaining pending or failed items.");
  }
}
