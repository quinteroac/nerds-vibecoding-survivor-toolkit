import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { exists } from "./state";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentProvider = "claude" | "codex" | "gemini" | "cursor" | "copilot" | "ide";

export interface AgentInvokeOptions {
  provider: AgentProvider;
  prompt: string;
  cwd?: string;
  /** Use interactive mode (e.g. Codex TUI) so the agent can interview the user. */
  interactive?: boolean;
  /** Suppress agent permission prompts (pass skip-permissions flags even in interactive mode). */
  yolo?: boolean;
  resolveCommandPath?: ResolveCommandPath;
}

export interface AgentResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type ResolveCommandPath = (command: string) => string | null | undefined;

// ---------------------------------------------------------------------------
// Provider helpers
// ---------------------------------------------------------------------------

const PROVIDERS: Record<AgentProvider, { cmd: string; args: string[] }> = {
  claude: { cmd: "claude", args: ["--dangerously-skip-permissions", "--print"] },
  codex: { cmd: "codex", args: ["exec", "--dangerously-bypass-approvals-and-sandbox"] },
  gemini: { cmd: "gemini", args: ["--yolo"] },
  cursor: { cmd: "agent", args: [] },
  copilot: { cmd: "copilot", args: ["-p", "--yolo", "--no-ask-user"] },
  ide: { cmd: "", args: [] },
};

export function parseProvider(name: string): AgentProvider {
  if (name in PROVIDERS) return name as AgentProvider;
  const valid = Object.keys(PROVIDERS).join(", ");
  throw new Error(`Unknown agent provider '${name}'. Valid providers: ${valid}`);
}

export function buildCommand(provider: AgentProvider): { cmd: string; args: string[] } {
  return PROVIDERS[provider];
}

function defaultResolveCommandPath(command: string): string | null {
  const resolved = Bun.which(command);
  return resolved ?? null;
}

export function ensureAgentCommandAvailable(
  provider: AgentProvider,
  resolveCommandPath: ResolveCommandPath = defaultResolveCommandPath,
): void {
  if (provider === "ide") {
    return;
  }

  const { cmd } = buildCommand(provider);
  if (resolveCommandPath(cmd)) return;

  if (provider === "cursor") {
    throw new Error(
      "Cursor agent CLI is unavailable: `agent` command not found in PATH. Install/configure Cursor Agent CLI or use another provider.",
    );
  }

  throw new Error(`Required CLI '${cmd}' for provider '${provider}' is not in PATH.`);
}

// ---------------------------------------------------------------------------
// Agent invocation
// ---------------------------------------------------------------------------
// For interactive interviews, claude/codex/copilot need a real TTY: pass prompt as
// positional arg and use stdin: "inherit" so the agent can read user input.
// ---------------------------------------------------------------------------

/** Codex interactive (TUI) args: no "exec", so it can read stdin for interview. */
const CODEX_INTERACTIVE_ARGS = ["--sandbox", "workspace-write"];

/**
 * Pure function that computes the final CLI args and stdin mode for a provider.
 * Exported for unit testing without spawning real processes.
 */
export function buildAgentArgs(
  provider: AgentProvider,
  prompt: string,
  interactive: boolean,
  yolo: boolean,
): { finalArgs: string[]; stdinOption: "ignore" | "inherit" } {
  const { args } = buildCommand(provider);

  if (provider === "gemini" && interactive) {
    return { finalArgs: [...args, prompt], stdinOption: "inherit" };
  }
  if (provider === "gemini") {
    return { finalArgs: [...args, "-p", prompt], stdinOption: "ignore" };
  }
  if (provider === "codex" && interactive) {
    const yoloArgs = yolo ? ["--dangerously-bypass-approvals-and-sandbox"] : [];
    return { finalArgs: [prompt, ...CODEX_INTERACTIVE_ARGS, ...yoloArgs], stdinOption: "inherit" };
  }
  if (provider === "claude" && interactive) {
    return { finalArgs: ["--dangerously-skip-permissions", prompt], stdinOption: "inherit" };
  }
  if (provider === "copilot" && interactive) {
    const yoloArgs = yolo ? ["--yolo", "--no-ask-user"] : [];
    return { finalArgs: ["-i", ...yoloArgs, prompt], stdinOption: "inherit" };
  }
  if (provider === "copilot") {
    return { finalArgs: ["-p", prompt, ...args.filter((arg) => arg !== "-p")], stdinOption: "inherit" };
  }
  return { finalArgs: [...args, prompt], stdinOption: "inherit" };
}

export async function invokeAgent(options: AgentInvokeOptions): Promise<AgentResult> {
  const {
    provider,
    prompt,
    cwd = process.cwd(),
    interactive = false,
    yolo = false,
    resolveCommandPath = defaultResolveCommandPath,
  } = options;
  if (provider === "ide") {
    process.stdout.write(`${prompt}\n`);
    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
  }

  const { cmd } = buildCommand(provider);
  ensureAgentCommandAvailable(provider, resolveCommandPath);

  const { finalArgs, stdinOption } = buildAgentArgs(provider, prompt, interactive, yolo);

  // Interactive mode: use real TTY (inherit) so the agent stays in interactive mode and
  // waits for user input. The agent writes output via write-json or to a file.
  // Non-interactive: use pipe to capture stdout/stderr.
  const useTty = interactive;
  const proc = Bun.spawn([cmd, ...finalArgs], {
    cwd,
    stdin: stdinOption,
    stdout: useTty ? "inherit" : "pipe",
    stderr: useTty ? "inherit" : "pipe",
  });

  let exitCode: number;
  let stdoutStr: string;
  let stderrStr: string;

  if (useTty) {
    exitCode = await proc.exited;
    stdoutStr = "";
    stderrStr = "";
  } else {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const readStream = async (
      stream: ReadableStream<Uint8Array<ArrayBuffer>> | undefined,
      chunks: string[],
      passthrough?: { write: (chunk: Uint8Array) => void },
    ) => {
      if (!stream) return;
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(decoder.decode(value, { stream: true }));
          if (passthrough) passthrough.write(value);
        }
      } finally {
        reader.releaseLock();
      }
    };
    await Promise.all([
      readStream(proc.stdout, stdoutChunks, process.stdout),
      readStream(proc.stderr, stderrChunks, process.stderr),
    ]);
    exitCode = await proc.exited;
    stdoutStr = stdoutChunks.join("");
    stderrStr = stderrChunks.join("");
  }

  return {
    exitCode,
    stdout: stdoutStr,
    stderr: stderrStr,
  };
}

// ---------------------------------------------------------------------------
// Skill loading
// ---------------------------------------------------------------------------

export async function loadSkill(projectRoot: string, skillName: string): Promise<string> {
  const projectPath = join(projectRoot, ".agents", "skills", skillName, "SKILL.md");
  const globalPath = join(homedir(), ".agents", "skills", skillName, "SKILL.md");

  const skillPath = (await exists(projectPath))
    ? projectPath
    : (await exists(globalPath))
      ? globalPath
      : null;

  if (!skillPath) {
    throw new Error(
      `Skill '${skillName}' not found at ${projectPath} or ${globalPath}`,
    );
  }
  const raw = await readFile(skillPath, "utf8");
  return stripFrontmatter(raw);
}

function stripFrontmatter(content: string): string {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) return content;
  const endIndex = trimmed.indexOf("---", 3);
  if (endIndex === -1) return content;
  return trimmed.slice(endIndex + 3).trimStart();
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

export function buildPrompt(skillBody: string, context: Record<string, string>): string {
  const parts = [skillBody];
  const entries = Object.entries(context);
  if (entries.length > 0) {
    parts.push("\n---\n\n## Context\n");
    for (const [key, value] of entries) {
      parts.push(`### ${key}\n\n${value}\n`);
    }
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// CLI arg parsing for --agent
// ---------------------------------------------------------------------------

export function parseAgentArg(args: string[]): {
  provider: AgentProvider;
  remainingArgs: string[];
} {
  const idx = args.indexOf("--agent");
  if (idx === -1 || idx + 1 >= args.length) {
    throw new Error("Missing required --agent <provider> argument.");
  }
  const provider = parseProvider(args[idx + 1]);
  const remainingArgs = [...args.slice(0, idx), ...args.slice(idx + 2)];
  return { provider, remainingArgs };
}
