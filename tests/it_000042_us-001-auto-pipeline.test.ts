/**
 * Tests for US-001: Run full prototype pipeline automatically
 * Iteration: 000042
 */
import { describe, it, expect } from "bun:test";
import { join } from "node:path";
import { runAuto } from "../src/commands/auto";
import { runAuditPrototype } from "../src/commands/audit-prototype";
import type { AgentInvokeOptions } from "../src/agent";

const CLI_PATH = join(import.meta.dir, "..", "src", "cli.ts");

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCli(args: string[]): Promise<CliResult> {
  const proc = Bun.spawn([process.argv[0], CLI_PATH, ...args], {
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
// AC01: `nvst auto --agent <provider>` is registered in cli.ts
// ---------------------------------------------------------------------------

describe("US-001-AC01: nvst auto is registered in cli.ts", () => {
  it("shows auto in --help output", async () => {
    const result = await runCli(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("auto");
  });

  it("auto --help shows --agent option", async () => {
    const result = await runCli(["auto", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--agent");
  });

  it("auto without --agent exits with error", async () => {
    const result = await runCli(["auto"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing required --agent");
  });
});

// ---------------------------------------------------------------------------
// AC02: runAuto calls all three phases in sequence
// ---------------------------------------------------------------------------

describe("US-001-AC02: runAuto calls create, audit, refactor in sequence", () => {
  it("calls all three sub-commands in order", async () => {
    const calls: string[] = [];

    await runAuto(
      { provider: "claude" },
      {
        runCreatePrototypeFn: async () => { calls.push("create"); },
        runAuditPrototypeFn: async () => { calls.push("audit"); },
        runRefactorPrototypeFn: async () => { calls.push("refactor"); },
      },
    );

    expect(calls).toEqual(["create", "audit", "refactor"]);
  });
});

// ---------------------------------------------------------------------------
// AC03: If runCreatePrototype fails, audit and refactor do not run
// ---------------------------------------------------------------------------

describe("US-001-AC03: create failure stops pipeline", () => {
  it("does not call audit or refactor when create throws", async () => {
    const calls: string[] = [];

    await expect(
      runAuto(
        { provider: "claude" },
        {
          runCreatePrototypeFn: async () => { throw new Error("create failed"); },
          runAuditPrototypeFn: async () => { calls.push("audit"); },
          runRefactorPrototypeFn: async () => { calls.push("refactor"); },
        },
      ),
    ).rejects.toThrow("create failed");

    expect(calls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC04: If runAuditPrototype fails, refactor does not run
// ---------------------------------------------------------------------------

describe("US-001-AC04: audit failure stops pipeline", () => {
  it("does not call refactor when audit throws", async () => {
    const calls: string[] = [];

    await expect(
      runAuto(
        { provider: "claude" },
        {
          runCreatePrototypeFn: async () => { calls.push("create"); },
          runAuditPrototypeFn: async () => { throw new Error("audit failed"); },
          runRefactorPrototypeFn: async () => { calls.push("refactor"); },
        },
      ),
    ).rejects.toThrow("audit failed");

    expect(calls).toEqual(["create"]);
  });
});

// ---------------------------------------------------------------------------
// AC05: All 3 phases complete successfully → resolves without error
// ---------------------------------------------------------------------------

describe("US-001-AC05: successful pipeline resolves cleanly", () => {
  it("resolves without error when all phases succeed", async () => {
    await expect(
      runAuto(
        { provider: "claude" },
        {
          runCreatePrototypeFn: async () => {},
          runAuditPrototypeFn: async () => {},
          runRefactorPrototypeFn: async () => {},
        },
      ),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC06: --force and --yolo flags are passed through to each sub-command
// ---------------------------------------------------------------------------

describe("US-001-AC06: --force and --yolo are passed through", () => {
  it("forwards force: true and yolo: true to all sub-commands", async () => {
    const captured: Array<{ force?: boolean; yolo?: boolean; name: string }> = [];

    await runAuto(
      { provider: "claude", force: true, yolo: true },
      {
        runCreatePrototypeFn: async (opts) => { captured.push({ name: "create", force: opts.force, yolo: opts.yolo }); },
        runAuditPrototypeFn: async (opts) => { captured.push({ name: "audit", force: opts.force, yolo: opts.yolo }); },
        runRefactorPrototypeFn: async (opts) => { captured.push({ name: "refactor", force: opts.force, yolo: opts.yolo }); },
      },
    );

    for (const c of captured) {
      expect(c.force).toBe(true);
      expect(c.yolo).toBe(true);
    }
  });

  it("auto --help shows --force option", async () => {
    const result = await runCli(["auto", "--help"]);
    expect(result.stdout).toContain("--force");
  });

  it("auto --help shows --yolo option", async () => {
    const result = await runCli(["auto", "--help"]);
    expect(result.stdout).toContain("--yolo");
  });
});

// ---------------------------------------------------------------------------
// AC07: runAuditPrototype is invoked with interactive: false from runAuto
// ---------------------------------------------------------------------------

describe("US-001-AC07: runAuditPrototype called with interactive: false", () => {
  it("passes interactive: false to audit sub-command", async () => {
    let capturedInteractive: boolean | undefined;

    await runAuto(
      { provider: "claude" },
      {
        runCreatePrototypeFn: async () => {},
        runAuditPrototypeFn: async (opts) => { capturedInteractive = opts.interactive; },
        runRefactorPrototypeFn: async () => {},
      },
    );

    expect(capturedInteractive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC08: runCreatePrototype and runRefactorPrototype retain default interactive
// ---------------------------------------------------------------------------

describe("US-001-AC08: create and refactor use default interactive behaviour", () => {
  it("create sub-command is not passed interactive: false", async () => {
    let capturedCreateOpts: Record<string, unknown> = {};

    await runAuto(
      { provider: "claude" },
      {
        runCreatePrototypeFn: async (opts) => { capturedCreateOpts = opts as unknown as Record<string, unknown>; },
        runAuditPrototypeFn: async () => {},
        runRefactorPrototypeFn: async () => {},
      },
    );

    // interactive is not set on CreatePrototypeOptions — no forced false
    expect(capturedCreateOpts["interactive"]).toBeUndefined();
  });

  it("refactor sub-command is not passed interactive: false", async () => {
    let capturedRefactorOpts: Record<string, unknown> = {};

    await runAuto(
      { provider: "claude" },
      {
        runCreatePrototypeFn: async () => {},
        runAuditPrototypeFn: async () => {},
        runRefactorPrototypeFn: async (opts) => { capturedRefactorOpts = opts as unknown as Record<string, unknown>; },
      },
    );

    expect(capturedRefactorOpts["interactive"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC07 (additional): AuditPrototypeOptions accepts interactive field
// and runAuditPrototype honours it
// ---------------------------------------------------------------------------

describe("US-001-AC07 (additional): AuditPrototypeOptions.interactive is honoured", () => {
  it("runAuditPrototype passes interactive: false to invokeAgentFn when set", async () => {
    let capturedInteractive: boolean | undefined;
    let capturedPrompt = "";

    const fakeInvoke = async (options: AgentInvokeOptions) => {
      capturedInteractive = options.interactive;
      capturedPrompt = options.prompt;
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const fakeState = {
      current_iteration: "000042",
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
      { provider: "claude", interactive: false },
      {
        invokeAgentFn: fakeInvoke,
        readStateFn: async () => fakeState,
        loadSkillFn: async () => "skill body",
        writeStateFn: async () => {},
      },
    );

    expect(capturedInteractive).toBe(false);
    expect(capturedPrompt).toContain("Auto Mode Directive");
    expect(capturedPrompt).toContain("Do not ask the user to choose options");
    expect(capturedPrompt).toContain("it_{iteration}_audit.json");
  });

  it("runAuditPrototype defaults interactive to true when not set", async () => {
    let capturedInteractive: boolean | undefined;

    const fakeInvoke = async (options: AgentInvokeOptions) => {
      capturedInteractive = options.interactive;
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const fakeState = {
      current_iteration: "000042",
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
        readStateFn: async () => fakeState,
        loadSkillFn: async () => "skill body",
        writeStateFn: async () => {},
      },
    );

    expect(capturedInteractive).toBe(true);
  });
});
