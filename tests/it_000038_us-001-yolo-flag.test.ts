/**
 * Tests for US-001: --yolo flag suppresses agent permission prompts
 * Iteration: 000038
 */
import { describe, it, expect } from "bun:test";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// CLI runner helper (shared pattern from other test files)
// ---------------------------------------------------------------------------

const CLI_PATH = join(import.meta.dir, "..", "src", "cli.ts");

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCli(args: string[], cwd?: string): Promise<CliResult> {
  const proc = Bun.spawn([process.argv[0], CLI_PATH, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
  return {
    exitCode: proc.exitCode ?? 1,
    stdout: await new Response(proc.stdout).text(),
    stderr: await new Response(proc.stderr).text(),
  };
}

// ---------------------------------------------------------------------------
// AC03: AgentInvokeOptions.yolo is optional
// ---------------------------------------------------------------------------

import { buildAgentArgs, type AgentInvokeOptions } from "../src/agent";

describe("US-001-AC03: AgentInvokeOptions.yolo is optional", () => {
  it("compiles with yolo omitted (TypeScript structural check)", () => {
    const opts: AgentInvokeOptions = {
      provider: "claude",
      prompt: "test",
      interactive: true,
      // yolo deliberately omitted — must be optional
    };
    expect(opts.yolo).toBeUndefined();
  });

  it("accepts yolo: true", () => {
    const opts: AgentInvokeOptions = {
      provider: "claude",
      prompt: "test",
      interactive: true,
      yolo: true,
    };
    expect(opts.yolo).toBe(true);
  });

  it("accepts yolo: false", () => {
    const opts: AgentInvokeOptions = {
      provider: "codex",
      prompt: "test",
      yolo: false,
    };
    expect(opts.yolo).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC04 / AC05: buildAgentArgs produces correct args for codex interactive
// ---------------------------------------------------------------------------

describe("US-001-AC04/AC05: buildAgentArgs for codex interactive", () => {
  it("AC05: yolo=false does NOT add --dangerously-bypass-approvals-and-sandbox", () => {
    const { finalArgs } = buildAgentArgs("codex", "hello", true, false);
    expect(finalArgs).not.toContain("--dangerously-bypass-approvals-and-sandbox");
  });

  it("AC04: yolo=true adds --dangerously-bypass-approvals-and-sandbox", () => {
    const { finalArgs } = buildAgentArgs("codex", "hello", true, true);
    expect(finalArgs).toContain("--dangerously-bypass-approvals-and-sandbox");
  });

  it("AC05: yolo=false non-interactive codex is unchanged (exec + dangerously flag)", () => {
    const { finalArgs: withoutYolo } = buildAgentArgs("codex", "hello", false, false);
    const { finalArgs: withYolo } = buildAgentArgs("codex", "hello", false, true);
    // Non-interactive path always uses PROVIDERS args — yolo doesn't change them
    expect(withoutYolo).toEqual(withYolo);
  });
});

// ---------------------------------------------------------------------------
// AC04 / AC05: buildAgentArgs produces correct args for copilot interactive
// ---------------------------------------------------------------------------

describe("US-001-AC04/AC05: buildAgentArgs for copilot interactive", () => {
  it("AC05: yolo=false does NOT add --no-ask-user in interactive copilot", () => {
    const { finalArgs } = buildAgentArgs("copilot", "hello", true, false);
    expect(finalArgs).not.toContain("--no-ask-user");
  });

  it("AC04: yolo=true adds --yolo and --no-ask-user in interactive copilot", () => {
    const { finalArgs } = buildAgentArgs("copilot", "hello", true, true);
    expect(finalArgs).toContain("--yolo");
    expect(finalArgs).toContain("--no-ask-user");
  });

  it("AC05: non-interactive copilot args are unchanged regardless of yolo", () => {
    const { finalArgs: withoutYolo } = buildAgentArgs("copilot", "hello", false, false);
    const { finalArgs: withYolo } = buildAgentArgs("copilot", "hello", false, true);
    expect(withoutYolo).toEqual(withYolo);
  });
});

// ---------------------------------------------------------------------------
// AC04 / AC05: buildAgentArgs for claude interactive (always has skip-permissions)
// ---------------------------------------------------------------------------

describe("US-001-AC05: buildAgentArgs for claude interactive has --dangerously-skip-permissions regardless of yolo", () => {
  it("yolo=false: claude interactive includes --dangerously-skip-permissions", () => {
    const { finalArgs } = buildAgentArgs("claude", "hello", true, false);
    expect(finalArgs).toContain("--dangerously-skip-permissions");
  });

  it("yolo=true: claude interactive still includes --dangerously-skip-permissions", () => {
    const { finalArgs } = buildAgentArgs("claude", "hello", true, true);
    expect(finalArgs).toContain("--dangerously-skip-permissions");
  });
});

// ---------------------------------------------------------------------------
// AC01: --yolo is declared on all 8 agent-invoking commands (via --help)
// ---------------------------------------------------------------------------

describe("US-001-AC01: --yolo declared on all agent-invoking commands", () => {
  const agentCommands = [
    ["ideate", "--help"],
    ["define", "requirement", "--help"],
    ["refine", "requirement", "--help"],
    ["refine", "project-context", "--help"],
    ["create", "prototype", "--help"],
    ["create", "project-context", "--help"],
    ["audit", "prototype", "--help"],
    ["refactor", "prototype", "--help"],
  ];

  for (const cmdArgs of agentCommands) {
    it(`shows --yolo in help for: nvst ${cmdArgs.slice(0, -1).join(" ")}`, async () => {
      const result = await runCli(cmdArgs);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("--yolo");
    });
  }
});

// ---------------------------------------------------------------------------
// AC02: handlers accept and forward yolo via dependency injection
// ---------------------------------------------------------------------------

import { runIdeate } from "../src/commands/ideate";
import { runAuditPrototype } from "../src/commands/audit-prototype";
import { runRefactorPrototype } from "../src/commands/refactor-prototype";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

async function createMinimalProject(dir: string, skillName: string): Promise<void> {
  await mkdir(join(dir, ".agents", "skills", skillName), { recursive: true });
  await writeFile(join(dir, ".agents", "skills", skillName, "SKILL.md"), `# ${skillName}`, "utf8");
}

describe("US-001-AC02: handlers forward yolo to invokeAgent", () => {
  it("runIdeate accepts yolo: true and invokes agent (ide provider — no subprocess)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nvst-yolo-handler-"));
    try {
      await createMinimalProject(dir, "ideate");
      process.chdir(dir);
      await expect(
        runIdeate({ provider: "ide", yolo: true }),
      ).resolves.toBeUndefined();
    } finally {
      process.chdir(join(import.meta.dir, ".."));
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runAuditPrototype passes yolo: true to invokeAgentFn", async () => {
    let capturedYolo: boolean | undefined;
    const fakeInvoke = async (options: AgentInvokeOptions) => {
      capturedYolo = options.yolo;
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const fakeReadState = async () => ({
      current_iteration: "000038",
      current_phase: "prototype" as const,
      flow_guardrail: "off" as const,
      last_updated: new Date().toISOString(),
      updated_by: "test",
      phases: {
        define: {
          ideation: null,
          requirement_definition: { status: "approved" as const, file: "prd.md" },
        },
        prototype: {
          project_context: { status: "created" as const, file: "ctx.md" },
          prototype_creation: { status: "completed" as const, file: null },
          prototype_audit: { status: "completed" as const, file: null },
          prototype_refactor: null,
          prototype_approval: null,
        },
      },
    });
    const fakeLoadSkill = async () => "skill body";

    await runAuditPrototype(
      { provider: "claude", yolo: true },
      { invokeAgentFn: fakeInvoke, existsFn: async () => true, readStateFn: fakeReadState, loadSkillFn: fakeLoadSkill, writeStateFn: async () => {} },
    );

    expect(capturedYolo).toBe(true);
  });

  it("runAuditPrototype passes yolo: false (default) to invokeAgentFn", async () => {
    let capturedYolo: boolean | undefined;
    const fakeInvoke = async (options: AgentInvokeOptions) => {
      capturedYolo = options.yolo;
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const fakeState = {
      current_iteration: "000038",
      current_phase: "prototype" as const,
      flow_guardrail: "off" as const,
      last_updated: new Date().toISOString(),
      updated_by: "test",
      phases: {
        define: {
          ideation: null,
          requirement_definition: { status: "approved" as const, file: "prd.md" },
        },
        prototype: {
          project_context: { status: "created" as const, file: "ctx.md" },
          prototype_creation: { status: "completed" as const, file: null },
          prototype_audit: { status: "completed" as const, file: null },
          prototype_refactor: null,
          prototype_approval: null,
        },
      },
    };
    await runAuditPrototype(
      { provider: "claude" },
      {
        invokeAgentFn: fakeInvoke,
        existsFn: async () => true,
        readStateFn: async () => fakeState,
        loadSkillFn: async () => "skill body",
        writeStateFn: async () => {},
      },
    );
    expect(capturedYolo).toBe(false);
  });

  it("runRefactorPrototype passes yolo: true to invokeAgentFn", async () => {
    let capturedYolo: boolean | undefined;
    const fakeInvoke = async (options: AgentInvokeOptions) => {
      capturedYolo = options.yolo;
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const fakeState = {
      current_iteration: "000038",
      current_phase: "prototype" as const,
      flow_guardrail: "off" as const,
      last_updated: new Date().toISOString(),
      updated_by: "test",
      phases: {
        define: {
          ideation: null,
          requirement_definition: { status: "approved" as const, file: "prd.md" },
        },
        prototype: {
          project_context: { status: "created" as const, file: "ctx.md" },
          prototype_creation: { status: "completed" as const, file: null },
          prototype_audit: { status: "completed" as const, file: null },
          prototype_refactor: null,
          prototype_approval: null,
        },
      },
    };

    await runRefactorPrototype(
      { provider: "claude", yolo: true },
      {
        invokeAgentFn: fakeInvoke,
        readStateFn: async () => fakeState,
        loadSkillFn: async () => "skill body",
        existsFn: async () => true,
      },
    );

    expect(capturedYolo).toBe(true);
  });
});

