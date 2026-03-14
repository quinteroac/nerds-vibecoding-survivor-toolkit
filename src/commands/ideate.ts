import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { buildPrompt, invokeAgent, loadSkill, type AgentProvider } from "../agent";
import { exists, readState, writeState } from "../state";

export interface IdeateOptions {
  provider: AgentProvider;
  force?: boolean;
}

export async function runIdeate(opts: IdeateOptions): Promise<void> {
  const { provider, force = false } = opts;
  const projectRoot = process.cwd();

  // AC02: Read ROADMAP.md and .agents/PROJECT_CONTEXT.md if they exist
  const roadmapPath = join(projectRoot, "ROADMAP.md");
  const projectContextPath = join(projectRoot, ".agents", "PROJECT_CONTEXT.md");

  const context: Record<string, string> = {};
  if (await exists(roadmapPath)) {
    context["ROADMAP.md"] = await readFile(roadmapPath, "utf8");
  }
  if (await exists(projectContextPath)) {
    context["PROJECT_CONTEXT.md"] = await readFile(projectContextPath, "utf8");
  }

  // AC03: Load skill
  const skillBody = await loadSkill(projectRoot, "ideate");

  // Build prompt with context (AC02)
  const prompt = buildPrompt(skillBody, context);

  // AC07: Guardrail – warns (does not hard-block) if wrong phase or already completed
  const state = await readState(projectRoot).catch(() => null);
  if (state) {
    const wrongPhase = state.current_phase !== "define";
    const alreadyCompleted = state.phases.define.ideation?.status === "completed";
    if ((wrongPhase || alreadyCompleted) && !force) {
      const reasons: string[] = [];
      if (wrongPhase) reasons.push(`current phase is '${state.current_phase}' (expected 'define')`);
      if (alreadyCompleted) reasons.push("ideation is already completed");
      process.stderr.write(`Warning: ${reasons.join("; ")}.\n`);
    }
  }

  // AC04: Invoke agent with interactive: true
  const result = await invokeAgent({
    provider,
    prompt,
    cwd: projectRoot,
    interactive: true,
  });

  // AC06: Throw if agent exits with non-zero code
  if (result.exitCode !== 0) {
    throw new Error(`Agent invocation failed with exit code ${result.exitCode}.`);
  }

  // AC05: Set ideation.status = "completed" and refresh last_updated
  if (state) {
    const nextState = {
      ...state,
      phases: {
        ...state.phases,
        define: {
          ...state.phases.define,
          ideation: { status: "completed" as const, file: null },
        },
      },
    };
    await writeState(projectRoot, nextState);
  }

  console.log("Ideation session started.");
}
