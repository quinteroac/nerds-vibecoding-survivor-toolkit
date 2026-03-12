import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentInvokeOptions,
  type AgentProvider,
  type AgentResult,
} from "../agent";
import { readState } from "../state";

export interface AuditPrototypeOptions {
  provider: AgentProvider;
  force?: boolean;
}

interface AuditPrototypeDeps {
  logFn: (message: string) => void;
  loadSkillFn: (projectRoot: string, skillName: string) => Promise<string>;
  invokeAgentFn: (options: AgentInvokeOptions) => Promise<AgentResult>;
  readIterationFn: (projectRoot: string) => Promise<string>;
}

const defaultDeps: AuditPrototypeDeps = {
  logFn: console.log,
  loadSkillFn: loadSkill,
  invokeAgentFn: invokeAgent,
  readIterationFn: async (projectRoot) => (await readState(projectRoot)).current_iteration,
};

export async function runAuditPrototype(
  opts: AuditPrototypeOptions,
  deps: Partial<AuditPrototypeDeps> = {},
): Promise<void> {
  const mergedDeps = { ...defaultDeps, ...deps };
  if (opts.provider !== "ide") {
    mergedDeps.logFn("nvst audit prototype is not implemented yet.");
    return;
  }

  const projectRoot = process.cwd();
  const skillBody = await mergedDeps.loadSkillFn(projectRoot, "audit-prototype");
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
