import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { exists } from "./state";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentProvider = "claude" | "codex" | "gemini";

export interface AgentInvokeOptions {
  provider: AgentProvider;
  prompt: string;
  cwd?: string;
}

export interface AgentResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

// ---------------------------------------------------------------------------
// Provider helpers
// ---------------------------------------------------------------------------

const PROVIDERS: Record<AgentProvider, { cmd: string; args: string[] }> = {
  claude: { cmd: "claude", args: ["--dangerously-skip-permissions", "--print"] },
  codex: { cmd: "codex", args: ["exec", "--dangerously-bypass-approvals-and-sandbox"] },
  gemini: { cmd: "gemini", args: ["--yolo"] },
};

export function parseProvider(name: string): AgentProvider {
  if (name in PROVIDERS) return name as AgentProvider;
  const valid = Object.keys(PROVIDERS).join(", ");
  throw new Error(`Unknown agent provider '${name}'. Valid providers: ${valid}`);
}

export function buildCommand(provider: AgentProvider): { cmd: string; args: string[] } {
  return PROVIDERS[provider];
}

// ---------------------------------------------------------------------------
// Agent invocation
// ---------------------------------------------------------------------------

export async function invokeAgent(options: AgentInvokeOptions): Promise<AgentResult> {
  const { provider, prompt, cwd = process.cwd() } = options;
  const { cmd, args } = buildCommand(provider);

  // Gemini receives prompt via -p flag; others via stdin.
  const finalArgs = provider === "gemini" ? ["-p", prompt, ...args] : [...args];

  const proc = Bun.spawn([cmd, ...finalArgs], {
    cwd,
    stdin: provider === "gemini" ? "ignore" : new Response(prompt),
    stdout: "pipe",
    stderr: "pipe",
  });

  // Stream stdout to terminal in real-time while capturing it.
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const readStream = async (
    stream: ReadableStream<Uint8Array> | null,
    chunks: string[],
    passthrough?: WritableStream<Uint8Array>,
  ) => {
    if (!stream) return;
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const writer = passthrough?.getWriter();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value, { stream: true }));
        if (writer) await writer.write(value);
      }
    } finally {
      reader.releaseLock();
      if (writer) {
        writer.releaseLock();
      }
    }
  };

  await Promise.all([
    readStream(proc.stdout, stdoutChunks, Bun.stdout),
    readStream(proc.stderr, stderrChunks, Bun.stderr),
  ]);

  const exitCode = await proc.exited;

  return {
    exitCode,
    stdout: stdoutChunks.join(""),
    stderr: stderrChunks.join(""),
  };
}

// ---------------------------------------------------------------------------
// Skill loading
// ---------------------------------------------------------------------------

export async function loadSkill(projectRoot: string, skillName: string): Promise<string> {
  const skillPath = join(projectRoot, ".agents", "skills", skillName, "SKILL.md");
  if (!(await exists(skillPath))) {
    throw new Error(`Skill '${skillName}' not found at ${skillPath}`);
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
