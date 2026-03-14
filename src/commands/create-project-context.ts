import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentProvider,
} from "../agent";
import { assertGuardrail } from "../guardrail";
import { exists, readState, writeState } from "../state";

export interface CreateProjectContextOptions {
  provider: AgentProvider;
  mode: "strict" | "yolo";
  force?: boolean;
}

export async function runCreateProjectContext(opts: CreateProjectContextOptions): Promise<void> {
  const { provider, mode, force = false } = opts;
  const projectRoot = process.cwd();
  const state = await readState(projectRoot);

  await assertGuardrail(
    state,
    state.phases.define.prd_generation.status !== "completed",
    "Cannot create project context: define.prd_generation must be completed first.",
    { force },
  );

  if (!state.phases.prototype.project_context) {
    state.phases.prototype.project_context = { status: "pending", file: null };
  }
  const projectContext = state.phases.prototype.project_context;
  await assertGuardrail(
    state,
    projectContext.status === "pending_approval",
    "Cannot create project context: project context is pending approval. " +
    "Run `bun nvst approve project-context` or `bun nvst refine project-context` first.",
    { force },
  );

  await assertGuardrail(
    state,
    projectContext.status === "created",
    "Cannot create project context: project context already exists. " +
    "Use `bun nvst refine project-context` to iterate on it.",
    { force },
  );

  await assertGuardrail(
    state,
    projectContext.status !== "pending",
    `Cannot create project context from status '${projectContext.status}'. Expected pending.`,
    { force },
  );

  const prdFile = state.phases.define.prd_generation.file;
  if (!prdFile) {
    throw new Error("Cannot create project context: define.prd_generation.file is missing.");
  }

  if (state.current_phase === "define") {
    state.current_phase = "prototype";
  }

  const skillBody = await loadSkill(projectRoot, "create-project-context");
  const prdPath = join(projectRoot, ".agents", "flow", prdFile);
  const prdContent = await readFile(prdPath, "utf8");

  const projectContextPath = join(projectRoot, ".agents", "PROJECT_CONTEXT.md");
  const existingProjectContext =
    (await exists(projectContextPath)) ? await readFile(projectContextPath, "utf8") : "";
  const agentsMdPath = join(projectRoot, "AGENTS.md");
  const agentsMdContent = (await exists(agentsMdPath)) ? await readFile(agentsMdPath, "utf8") : "";

  const context: Record<string, string> = {
    mode,
    prd_file: prdFile,
    prd_content: prdContent,
  };

  if (existingProjectContext) {
    context.existing_project_context = existingProjectContext;
  }
  if (agentsMdContent) {
    context.agents_md = agentsMdContent;
  }

  // Include the previous iteration's artifacts so the agent can update AGENTS.md
  // based on what was actually delivered.
  const history = state.history ?? [];
  if (history.length > 0) {
    const lastEntry = history[history.length - 1];
    const prevIteration = lastEntry.iteration;
    const prevArchivedPath = join(projectRoot, lastEntry.archived_path);
    context.previous_iteration = prevIteration;

    const prevPrdMdPath = join(prevArchivedPath, `it_${prevIteration}_product-requirement-document.md`);
    if (await exists(prevPrdMdPath)) {
      context.previous_iteration_prd = await readFile(prevPrdMdPath, "utf8");
    }

    const prevProgressPath = join(prevArchivedPath, `it_${prevIteration}_progress.json`);
    if (await exists(prevProgressPath)) {
      context.previous_iteration_progress = await readFile(prevProgressPath, "utf8");
    }
  }

  const prompt = buildPrompt(skillBody, context);
  const result = await invokeAgent({
    provider,
    prompt,
    cwd: projectRoot,
    interactive: true,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Agent invocation failed with exit code ${result.exitCode}.`);
  }

  projectContext.status = "pending_approval";
  projectContext.file = ".agents/PROJECT_CONTEXT.md";
  state.last_updated = new Date().toISOString();
  state.updated_by = "nvst:create-project-context";

  await writeState(projectRoot, state);

  console.log("Project context generated and marked as pending approval.");
}
