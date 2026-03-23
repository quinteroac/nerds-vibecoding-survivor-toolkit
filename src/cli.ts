#!/usr/bin/env bun

import { join } from "node:path";
import { Command, CommanderError, InvalidArgumentError, Option } from "commander";
import { parseProvider, type AgentProvider } from "./agent";
import { runStartIteration } from "./commands/start-iteration";
import { runAuditPrototype } from "./commands/audit-prototype";
import { GuardrailAbortError } from "./guardrail";
import { runApprovePrototype } from "./commands/approve-prototype";
import { runApproveProjectContext } from "./commands/approve-project-context";
import { runApproveRequirement } from "./commands/approve-requirement";
import { runCreateProjectContext } from "./commands/create-project-context";
import { runCreatePrototype } from "./commands/create-prototype";
import { runDefineRequirement } from "./commands/define-requirement";
import { runDestroy } from "./commands/destroy";
import { runInit } from "./commands/init";
import { runRefactorPrototype } from "./commands/refactor-prototype";
import { runRefineProjectContext } from "./commands/refine-project-context";
import { runRefineRequirement } from "./commands/refine-requirement";
import { runSyncAgentSkills } from "./commands/sync-agent-skills";
import { runWriteJson } from "./commands/write-json";
import { runWriteTechnicalDebt } from "./commands/write-technical-debt";
import { runIdeate } from "./commands/ideate";

declare const NVST_COMPILED_VERSION: string;

async function resolveVersion(): Promise<string> {
  if (typeof NVST_COMPILED_VERSION === "string" && NVST_COMPILED_VERSION.length > 0) {
    return NVST_COMPILED_VERSION;
  }
  const pkgPath = join(import.meta.dir, "..", "package.json");
  try {
    const pkg = (await Bun.file(pkgPath).json()) as { version?: string };
    return pkg?.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function parseIntegerArg(min: number): (value: string) => number {
  return (value: string): number => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < min) {
      throw new InvalidArgumentError(`Expected an integer >= ${min}.`);
    }
    return n;
  };
}

function validateAgent(agent: string | undefined, program: Command): AgentProvider | null {
  if (!agent) {
    console.error("Missing required --agent <provider> argument.");
    program.outputHelp();
    process.exitCode = 1;
    return null;
  }
  try {
    return parseProvider(agent);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    program.outputHelp();
    process.exitCode = 1;
    return null;
  }
}

async function main() {
  const version = await resolveVersion();

  const program = new Command();
  program
    .name("nvst")
    .description("NVST – Nerds Vibecoding Survivor Toolkit")
    .helpOption("-h, --help", "Show this help message")
    .version(version, "-v, --version", "Print version")
    .exitOverride()
    .configureOutput({ writeErr: (str) => process.stderr.write(str) });

  // ---- ideate ----
  program
    .command("ideate")
    .description("Start an ideation session via agent (optional preliminary step)")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--force", "Bypass flow guardrail confirmation")
    .action(async (opts) => {
      const provider = validateAgent(opts.agent, program);
      if (provider === null) return;
      await runIdeate({ provider, force: !!opts.force });
    });

  // ---- start ----
  const start = program.command("start").description("Start a new iteration, archiving flow files");
  start
    .command("iteration")
    .description("Start a new iteration, archiving flow files")
    .action(async () => {
      await runStartIteration();
    });
  start.on("command:*", (operands: string[]) => {
    console.error(`Unknown start subcommand: ${operands[0]}`);
    program.outputHelp();
    process.exitCode = 1;
  });

  // ---- define ----
  const define = program.command("define").description("Create requirement document via agent");
  define
    .command("requirement")
    .description("Create requirement document via agent")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--force", "Bypass flow guardrail confirmation")
    .action(async (opts) => {
      const provider = validateAgent(opts.agent, program);
      if (provider === null) return;
      await runDefineRequirement({ provider, force: !!opts.force });
    });
  define.on("command:*", (operands: string[]) => {
    console.error(`Unknown define subcommand: ${operands[0]}`);
    program.outputHelp();
    process.exitCode = 1;
  });

  // ---- refine ----
  const refine = program.command("refine").description("Refine requirement document or project context via agent");
  refine
    .command("requirement")
    .description("Refine requirement document via agent")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--challenge", "Run in challenger mode")
    .option("--force", "Bypass flow guardrail confirmation")
    .action(async (opts) => {
      const provider = validateAgent(opts.agent, program);
      if (provider === null) return;
      await runRefineRequirement({ provider, challenge: !!opts.challenge, force: !!opts.force });
    });
  refine
    .command("project-context")
    .description("Refine PROJECT_CONTEXT.md via agent")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--challenge", "Run in challenger mode")
    .option("--force", "Bypass flow guardrail confirmation")
    .action(async (opts) => {
      const provider = validateAgent(opts.agent, program);
      if (provider === null) return;
      await runRefineProjectContext({ provider, challenge: !!opts.challenge, force: !!opts.force });
    });
  refine.on("command:*", (operands: string[]) => {
    console.error(`Unknown refine subcommand: ${operands[0]}`);
    program.outputHelp();
    process.exitCode = 1;
  });

  // ---- approve ----
  const approve = program.command("approve").description("Mark requirement, project-context, or prototype as approved");
  approve
    .command("requirement")
    .description("Mark requirement definition as approved")
    .option("--force", "Bypass flow guardrail confirmation")
    .action(async (opts) => {
      await runApproveRequirement({ force: !!opts.force });
    });
  approve
    .command("project-context")
    .description("Mark project context as approved")
    .option("--force", "Bypass flow guardrail confirmation")
    .action(async (opts) => {
      await runApproveProjectContext({ force: !!opts.force });
    });
  approve
    .command("prototype")
    .description("Stage and commit all pending changes for current iteration")
    .option("--force", "Bypass flow guardrail confirmation")
    .action(async (opts) => {
      await runApprovePrototype({ force: !!opts.force });
    });
  approve.on("command:*", (operands: string[]) => {
    console.error(`Unknown approve subcommand: ${operands[0]}`);
    program.outputHelp();
    process.exitCode = 1;
  });

  // ---- create ----
  const create = program.command("create").description("Generate project-context or prototype via agent");
  create
    .command("prototype")
    .description("Initialize prototype build for current iteration")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--iterations <N>", "Maximum prototype passes (integer >= 1)", parseIntegerArg(1))
    .option("--retry-on-fail <N>", "Retry attempts per failed story (integer >= 0)", parseIntegerArg(0))
    .option("--stop-on-critical", "Stop execution after critical failures")
    .option("--force", "Bypass flow guardrail confirmation")
    .action(async (opts) => {
      const provider = validateAgent(opts.agent, program);
      if (provider === null) return;
      await runCreatePrototype({
        provider,
        iterations: opts.iterations,
        retryOnFail: opts.retryOnFail,
        stopOnCritical: !!opts.stopOnCritical,
        force: !!opts.force,
      });
    });
  create
    .command("project-context")
    .description("Generate PROJECT_CONTEXT.md via agent")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .addOption(
      new Option("--mode <strict|yolo>", "Generation mode (default: strict)").choices(["strict", "yolo"]).default("strict"),
    )
    .option("--force", "Bypass flow guardrail confirmation")
    .action(async (opts) => {
      const provider = validateAgent(opts.agent, program);
      if (provider === null) return;
      await runCreateProjectContext({ provider, mode: opts.mode, force: !!opts.force });
    });
  create.on("command:*", (operands: string[]) => {
    console.error(`Unknown create subcommand: ${operands[0]}`);
    program.outputHelp();
    process.exitCode = 1;
  });

  // ---- audit ----
  const audit = program.command("audit").description("Execute approved prototype audit tests via agent");
  audit
    .command("prototype")
    .description("Execute approved prototype audit tests via agent")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--force", "Bypass flow guardrail confirmation")
    .action(async (opts) => {
      const provider = validateAgent(opts.agent, program);
      if (provider === null) return;
      await runAuditPrototype({ provider, force: !!opts.force });
    });
  audit.on("command:*", (operands: string[]) => {
    console.error(`Unknown audit subcommand: ${operands[0]}`);
    program.outputHelp();
    process.exitCode = 1;
  });

  // ---- refactor ----
  const refactor = program.command("refactor").description("Execute approved prototype refactor items via agent");
  refactor
    .command("prototype")
    .description("Execute approved prototype refactor items via agent")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--force", "Bypass flow guardrail confirmation")
    .action(async (opts) => {
      const provider = validateAgent(opts.agent, program);
      if (provider === null) return;
      await runRefactorPrototype({ provider, force: !!opts.force });
    });
  refactor.on("command:*", (operands: string[]) => {
    console.error(`Unknown refactor subcommand: ${operands[0]}`);
    program.outputHelp();
    process.exitCode = 1;
  });

  // ---- sync ----
  const sync = program.command("sync").description("Copy .agents/skills/ to scaffold/.agents/skills/");
  sync
    .command("skills")
    .description("Copy .agents/skills/ to scaffold/.agents/skills/ (keep both identical)")
    .action(async () => {
      await runSyncAgentSkills();
    });
  sync.on("command:*", (operands: string[]) => {
    console.error(`Unknown sync subcommand: ${operands[0]}`);
    program.outputHelp();
    process.exitCode = 1;
  });

  // ---- init ----
  program
    .command("init")
    .description("Initialize toolkit files in the current directory")
    .action(async () => {
      await runInit();
    });

  // ---- destroy ----
  program
    .command("destroy")
    .description("Remove files generated by nvst")
    .option("--clean", "Also removes .agents/flow/archived")
    .action(async (opts) => {
      await runDestroy({ clean: !!opts.clean });
    });

  // ---- write-json ----
  program
    .command("write-json")
    .description("Write a schema-validated JSON file")
    .option("--schema <name>", "Schema name")
    .option("--out <path>", "Output path")
    .option("--data <json>", "JSON payload (or via stdin)")
    .action(async (opts) => {
      const args: string[] = [];
      if (opts.schema) args.push("--schema", opts.schema);
      if (opts.out) args.push("--out", opts.out);
      if (opts.data) args.push("--data", opts.data);
      await runWriteJson({ args });
    });

  // ---- write-technical-debt ----
  program
    .command("write-technical-debt")
    .description("Append technical debt items to .agents/TECHNICAL_DEBT.md")
    .option("--out <path>", "Output path")
    .option("--data <json>", "JSON payload (or via stdin)")
    .action(async (opts) => {
      const args: string[] = [];
      if (opts.out) args.push("--out", opts.out);
      if (opts.data) args.push("--data", opts.data);
      await runWriteTechnicalDebt({ args });
    });

  // ---- unknown top-level commands ----
  program.on("command:*", (operands: string[]) => {
    console.error(`Unknown command: ${operands[0]}`);
    program.outputHelp();
    process.exitCode = 1;
  });

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.exitCode === 0) return;
      process.exitCode = error.exitCode;
      return;
    }
    if (error instanceof GuardrailAbortError) {
      // exitCode already set and "Aborted." already written by assertGuardrail
      return;
    }
    console.error("nvst failed:", error);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  if (error instanceof GuardrailAbortError) {
    // exitCode already set and "Aborted." already written by assertGuardrail
    return;
  }
  console.error("nvst failed:", error);
  process.exitCode = 1;
});
