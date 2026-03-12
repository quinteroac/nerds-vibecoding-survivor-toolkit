import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentInvokeOptions,
  type AgentProvider,
  type AgentResult,
} from "../agent";
import { readState } from "../state";

export interface RefactorPrototypeOptions {
  provider: AgentProvider;
  force?: boolean;
}

interface RefactorPrototypeDeps {
  logFn: (message: string) => void;
  loadSkillFn: (projectRoot: string, skillName: string) => Promise<string>;
  invokeAgentFn: (options: AgentInvokeOptions) => Promise<AgentResult>;
  readIterationFn: (projectRoot: string) => Promise<string>;
}

const defaultDeps: RefactorPrototypeDeps = {
  logFn: console.log,
  loadSkillFn: loadSkill,
  invokeAgentFn: invokeAgent,
  readIterationFn: async (projectRoot) => (await readState(projectRoot)).current_iteration,
};

export async function runRefactorPrototype(
  opts: RefactorPrototypeOptions,
  deps: Partial<RefactorPrototypeDeps> = {},
): Promise<void> {
  const mergedDeps = { ...defaultDeps, ...deps };
  if (opts.provider !== "ide") {
    mergedDeps.logFn("nvst refactor prototype is not implemented yet.");
    return;
  }

  const projectRoot = process.cwd();
  const skillBody = await mergedDeps.loadSkillFn(projectRoot, "refactor-prototype");
  const currentIteration = await mergedDeps.readIterationFn(projectRoot);
  const prompt = buildPrompt(skillBody, { iteration: currentIteration });
  const result = await mergedDeps.invokeAgentFn({
    provider: opts.provider,
    prompt,
    cwd: projectRoot,
    interactive: true,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Agent invocation failed with exit code ${result.exitCode}.`);
  }
}
