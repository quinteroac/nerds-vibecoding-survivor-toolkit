import { join } from "node:path";
import { z } from "zod";

import {
  buildPrompt,
  invokeAgent,
  loadSkill,
  type AgentProvider,
} from "../agent";
import { readState, FLOW_REL_DIR } from "../state";
import { IssuesSchema, type Issue } from "../../scaffold/schemas/tmpl_issues";

// ---------------------------------------------------------------------------
// Agent output schema — agent produces title+description only
// ---------------------------------------------------------------------------

const AgentIssueSchema = z.object({
  title: z.string(),
  description: z.string(),
});

const AgentOutputSchema = z.array(AgentIssueSchema);

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CreateIssueOptions {
  provider: AgentProvider;
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

export async function runCreateIssue(opts: CreateIssueOptions): Promise<void> {
  const { provider } = opts;
  const projectRoot = process.cwd();
  const state = await readState(projectRoot);

  const iteration = state.current_iteration;

  // Load skill and build prompt
  const skillBody = await loadSkill(projectRoot, "create-issue");
  const prompt = buildPrompt(skillBody, {
    current_iteration: iteration,
  });

  // Invoke agent interactively
  const result = await invokeAgent({
    provider,
    prompt,
    cwd: projectRoot,
    interactive: true,
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `Agent invocation failed with exit code ${result.exitCode}.`,
    );
  }

  // For interactive mode, agent output is not captured (stdout: "inherit").
  // The agent writes the ISSUES file directly, or the user pastes output.
  // We need to find the output. Interactive agents write to the filesystem.
  // Check if the agent already created the file:
  const outputFileName = `it_${iteration}_ISSUES.json`;
  const outputRelPath = join(FLOW_REL_DIR, outputFileName);
  const outputAbsPath = join(projectRoot, outputRelPath);

  // Try to read agent output from the file the agent may have created,
  // or parse stdout if available (non-interactive fallback).
  let agentOutput = result.stdout.trim();

  if (!agentOutput) {
    // Interactive mode: agent should have written the file itself via the skill.
    // Check if file exists and validate it.
    const { exists } = await import("../state");
    if (await exists(outputAbsPath)) {
      const { readFile } = await import("node:fs/promises");
      agentOutput = await readFile(outputAbsPath, "utf8");
    } else {
      throw new Error(
        "Agent did not produce output. Expected JSON array of issues on stdout or written to file.",
      );
    }
  }

  // Extract JSON from agent output (may contain markdown fences)
  const jsonStr = extractJson(agentOutput);

  // Parse the raw JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(
      `Failed to parse agent output as JSON. Raw output:\n${agentOutput}`,
    );
  }

  // Validate agent output shape (title + description only)
  const agentResult = AgentOutputSchema.safeParse(parsed);
  if (!agentResult.success) {
    const formatted = agentResult.error.format();
    throw new Error(
      `Agent output does not match expected format:\n${JSON.stringify(formatted, null, 2)}`,
    );
  }

  // Auto-generate id and set status to "open" (AC02)
  const issues: Issue[] = agentResult.data.map((item, index) => ({
    id: `ISSUE-${iteration}-${String(index + 1).padStart(3, "0")}`,
    title: item.title,
    description: item.description,
    status: "open" as const,
  }));

  // Validate against full ISSUES schema (AC03)
  const validationResult = IssuesSchema.safeParse(issues);
  if (!validationResult.success) {
    const formatted = validationResult.error.format();
    throw new Error(
      `Generated issues failed schema validation:\n${JSON.stringify(formatted, null, 2)}`,
    );
  }

  // Write validated issues via write-json CLI (AC04)
  const dataStr = JSON.stringify(validationResult.data);
  const proc = Bun.spawn(
    [
      "bun",
      "run",
      join(projectRoot, "src/cli.ts"),
      "write-json",
      "--schema",
      "issues",
      "--out",
      outputRelPath,
      "--data",
      dataStr,
    ],
    { cwd: projectRoot, stdout: "pipe", stderr: "pipe" },
  );

  const writeExitCode = await proc.exited;
  if (writeExitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to write issues file: ${stderr}`);
  }

  console.log(`Issues file created: ${outputRelPath}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract JSON array from text that may contain markdown fences or surrounding text. */
export function extractJson(text: string): string {
  // Try to find JSON array in markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Try to find a JSON array directly
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  // Return as-is and let JSON.parse handle it
  return text;
}
