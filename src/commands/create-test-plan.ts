import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentInvokeOptions,
  type AgentProvider,
  type AgentResult,
} from "../agent";
import { exists, FLOW_REL_DIR, readState, writeState } from "../state";

export interface CreateTestPlanOptions {
  provider: AgentProvider;
  force?: boolean;
}

interface CreateTestPlanDeps {
  confirmOverwriteFn: (question: string) => Promise<boolean>;
  existsFn: (path: string) => Promise<boolean>;
  invokeAgentFn: (options: AgentInvokeOptions) => Promise<AgentResult>;
  loadSkillFn: (projectRoot: string, skillName: string) => Promise<string>;
  mkdirFn: typeof mkdir;
  nowFn: () => Date;
  readFileFn: typeof readFile;
}

const defaultDeps: CreateTestPlanDeps = {
  confirmOverwriteFn: promptForConfirmation,
  existsFn: exists,
  invokeAgentFn: invokeAgent,
  loadSkillFn: loadSkill,
  mkdirFn: mkdir,
  nowFn: () => new Date(),
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

export async function runCreateTestPlan(
  opts: CreateTestPlanOptions,
  deps: Partial<CreateTestPlanDeps> = {},
): Promise<void> {
  const projectRoot = process.cwd();
  const state = await readState(projectRoot);
  const mergedDeps: CreateTestPlanDeps = { ...defaultDeps, ...deps };

  if (state.phases.prototype.project_context.status !== "created") {
    throw new Error(
      "Cannot create test plan: prototype.project_context.status must be created. Run `bun nvst approve project-context` first.",
    );
  }

  const iteration = state.current_iteration;
  const fileName = `it_${iteration}_test-plan.md`;
  const flowDir = join(projectRoot, FLOW_REL_DIR);
  const outputPath = join(flowDir, fileName);

  await mergedDeps.mkdirFn(flowDir, { recursive: true });

  if ((await mergedDeps.existsFn(outputPath)) && !opts.force) {
    const shouldOverwrite = await mergedDeps.confirmOverwriteFn(
      `Test plan file already exists at ${join(FLOW_REL_DIR, fileName)}. Overwrite? [y/N] `,
    );

    if (!shouldOverwrite) {
      console.log("Test plan creation cancelled.");
      return;
    }
  }

  let skillBody: string;
  try {
    skillBody = await mergedDeps.loadSkillFn(projectRoot, "create-test-plan");
  } catch {
    throw new Error(
      "Required skill missing: expected .agents/skills/create-test-plan/SKILL.md.",
    );
  }

  const projectContextPath = join(projectRoot, ".agents", "PROJECT_CONTEXT.md");
  if (!(await mergedDeps.existsFn(projectContextPath))) {
    throw new Error("Project context missing: expected .agents/PROJECT_CONTEXT.md.");
  }

  const projectContextContent = await mergedDeps.readFileFn(projectContextPath, "utf8");
  const prompt = buildPrompt(skillBody, {
    iteration,
    project_context: projectContextContent,
  });

  const result = await mergedDeps.invokeAgentFn({
    provider: opts.provider,
    prompt,
    cwd: projectRoot,
    interactive: true,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Agent invocation failed with exit code ${result.exitCode}.`);
  }

  if (!(await mergedDeps.existsFn(outputPath)) && result.stdout.trim().length > 0) {
    const content = result.stdout.endsWith("\n") ? result.stdout : `${result.stdout}\n`;
    await Bun.write(outputPath, content);
  }

  if (!(await mergedDeps.existsFn(outputPath))) {
    throw new Error(
      `Test plan generation did not produce ${join(FLOW_REL_DIR, fileName)}.`,
    );
  }

  state.phases.prototype.test_plan.status = "pending_approval";
  state.phases.prototype.test_plan.file = fileName;
  state.last_updated = mergedDeps.nowFn().toISOString();
  state.updated_by = "nvst:create-test-plan";

  await writeState(projectRoot, state);

  console.log("Test plan generated and marked as pending approval.");
}
