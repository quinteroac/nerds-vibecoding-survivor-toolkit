import { buildPrompt, invokeAgent, loadSkill, type AgentProvider } from "../agent";

export interface IdeateOptions {
  provider: AgentProvider;
  force?: boolean;
}

export async function runIdeate(opts: IdeateOptions): Promise<void> {
  const { provider } = opts;
  const projectRoot = process.cwd();

  const skillBody = await loadSkill(projectRoot, "ideate");
  const prompt = buildPrompt(skillBody, {});
  const result = await invokeAgent({
    provider,
    prompt,
    cwd: projectRoot,
    interactive: true,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Agent invocation failed with exit code ${result.exitCode}.`);
  }

  console.log("Ideation session started.");
}
