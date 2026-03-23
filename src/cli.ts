#!/usr/bin/env bun

import { join } from "node:path";
import { Command } from "commander";
import { parseAgentArg } from "./agent";
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

export function extractFlagValue(args: string[], flag: string): { value: string | null; remainingArgs: string[] } {
  const idx = args.indexOf(flag);
  if (idx === -1) {
    return { value: null, remainingArgs: args };
  }

  if (idx + 1 >= args.length) {
    throw new Error(`Missing value for ${flag}.`);
  }

  const value = args[idx + 1];
  return {
    value,
    remainingArgs: [...args.slice(0, idx), ...args.slice(idx + 2)],
  };
}

function parseOptionalIntegerFlag(
  args: string[],
  flag: "--iterations" | "--retry-on-fail",
  min: number,
): { value: number | undefined; remainingArgs: string[] } {
  const { value, remainingArgs } = extractFlagValue(args, flag);
  if (value === null) {
    return { value: undefined, remainingArgs };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(
      `Invalid ${flag} value '${value}'. Expected an integer >= ${min}.`,
    );
  }

  return { value: parsed, remainingArgs };
}

function parseProjectContextMode(
  args: string[],
): { mode: "strict" | "yolo"; remainingArgs: string[] } {
  const { value, remainingArgs } = extractFlagValue(args, "--mode");
  if (value === null) {
    return { mode: "strict", remainingArgs };
  }

  if (value !== "strict" && value !== "yolo") {
    throw new Error(
      `Invalid --mode value '${value}'. Expected one of: strict, yolo.`,
    );
  }

  return { mode: value, remainingArgs };
}

function parseForce(args: string[]): { force: boolean; remainingArgs: string[] } {
  const force = args.includes("--force");
  return {
    force,
    remainingArgs: args.filter((arg) => arg !== "--force"),
  };
}

function buildHelpProgram(): Command {
  const program = new Command();
  program.name("nvst").description("NVST – Nerds Vibecoding Survivor Toolkit").helpOption("-h, --help", "Show this help message");

  program
    .command("ideate")
    .description("Start an ideation session via agent (optional preliminary step)")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--force", "Bypass flow guardrail confirmation");

  const start = program.command("start").description("Start a new iteration, archiving flow files");
  start.command("iteration").description("Start a new iteration, archiving flow files");

  const define = program.command("define").description("Create requirement document via agent");
  define
    .command("requirement")
    .description("Create requirement document via agent")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--force", "Bypass flow guardrail confirmation");

  const refine = program.command("refine").description("Refine requirement document or project context via agent");
  refine
    .command("requirement")
    .description("Refine requirement document via agent")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--challenge", "Run in challenger mode")
    .option("--force", "Bypass flow guardrail confirmation");
  refine
    .command("project-context")
    .description("Refine PROJECT_CONTEXT.md via agent")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--challenge", "Run in challenger mode")
    .option("--force", "Bypass flow guardrail confirmation");

  const approve = program.command("approve").description("Mark requirement, project-context, or prototype as approved");
  approve
    .command("requirement")
    .description("Mark requirement definition as approved")
    .option("--force", "Bypass flow guardrail confirmation");
  approve
    .command("project-context")
    .description("Mark project context as approved")
    .option("--force", "Bypass flow guardrail confirmation");
  approve
    .command("prototype")
    .description("Stage and commit all pending changes for current iteration")
    .option("--force", "Bypass flow guardrail confirmation");

  const create = program.command("create").description("Generate project-context or prototype via agent");
  create
    .command("prototype")
    .description("Initialize prototype build for current iteration")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--iterations <N>", "Maximum prototype passes (integer >= 1)")
    .option("--retry-on-fail <N>", "Retry attempts per failed story (integer >= 0)")
    .option("--stop-on-critical", "Stop execution after critical failures")
    .option("--force", "Bypass flow guardrail confirmation");
  create
    .command("project-context")
    .description("Generate PROJECT_CONTEXT.md via agent")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--mode <strict|yolo>", "Generation mode (default: strict)")
    .option("--force", "Bypass flow guardrail confirmation");

  const audit = program.command("audit").description("Execute approved prototype audit tests via agent");
  audit
    .command("prototype")
    .description("Execute approved prototype audit tests via agent")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--force", "Bypass flow guardrail confirmation");

  const refactor = program.command("refactor").description("Execute approved prototype refactor items via agent");
  refactor
    .command("prototype")
    .description("Execute approved prototype refactor items via agent")
    .option("--agent <provider>", "Agent provider (claude, codex, gemini, cursor, copilot, ide)")
    .option("--force", "Bypass flow guardrail confirmation");

  const sync = program.command("sync").description("Copy .agents/skills/ to scaffold/.agents/skills/");
  sync.command("skills").description("Copy .agents/skills/ to scaffold/.agents/skills/ (keep both identical)");

  program
    .command("init")
    .description("Initialize toolkit files in the current directory");

  program
    .command("destroy")
    .description("Remove files generated by nvst")
    .option("--clean", "Also removes .agents/flow/archived");

  program
    .command("write-json")
    .description("Write a schema-validated JSON file")
    .option("--schema <name>", "Schema name")
    .option("--out <path>", "Output path")
    .option("--data <json>", "JSON payload (or via stdin)");

  program
    .command("write-technical-debt")
    .description("Append technical debt items to .agents/TECHNICAL_DEBT.md")
    .option("--out <path>", "Output path")
    .option("--data <json>", "JSON payload (or via stdin)");

  return program;
}

function findCommand(program: Command, path: string[]): Command | undefined {
  let current: Command = program;
  for (const name of path) {
    const found = current.commands.find((c) => c.name() === name);
    if (!found) return undefined;
    current = found;
  }
  return current;
}

function printUsage() {
  console.log(`Usage: nvst <command> [options]

Primary workflow:
  ideate --agent <provider> [--force]
                     Start an ideation session via agent (optional preliminary step)
  start iteration    Start a new iteration, archiving flow files
  define requirement --agent <provider> [--force]
                     Create requirement document via agent
  refine requirement --agent <provider> [--challenge] [--force]
                     Refine requirement document via agent
  approve requirement [--force]
                     Mark requirement definition as approved
  create project-context --agent <provider> [--mode <strict|yolo>] [--force]
                     Generate PROJECT_CONTEXT.md via agent
  refine project-context --agent <provider> [--challenge] [--force]
                     Refine PROJECT_CONTEXT.md via agent
  approve project-context [--force]
                     Mark project context as approved
  create prototype --agent <provider> [--iterations <N>] [--retry-on-fail <N>] [--stop-on-critical] [--force]
                     Initialize prototype build for current iteration
  audit prototype --agent <provider> [--force]
                     Execute approved prototype audit tests via agent
  refactor prototype --agent <provider> [--force]
                     Execute approved prototype refactor items via agent
  approve prototype [--force]
                     Stage and commit all pending changes for current iteration

Utilities:
  init               Initialize toolkit files in the current directory
  destroy [--clean]  Remove files generated by nvst
  sync skills         Copy .agents/skills/ to scaffold/.agents/skills/ (keep both identical)
  write-json --schema <name> --out <path> [--data '<json>']
                     Write a schema-validated JSON file (payload via --data or stdin)
  write-technical-debt [--out <path>] [--data '<json>']
                     Append technical debt items to .agents/TECHNICAL_DEBT.md (payload via --data or stdin)

Options:
  --agent            Agent provider for agent-backed commands
                     Valid providers: claude, codex, gemini, cursor, copilot, ide
                     ide prints skill prompts to stdout instead of invoking an agent subprocess
  --iterations       Maximum prototype passes (integer >= 1)
  --retry-on-fail    Retry attempts per failed story (integer >= 0)
  --stop-on-critical Stop execution after critical failures
  --force            Bypass flow guardrail confirmation
  --challenge        Run requirement refine in challenger mode
  --mode             Project-context generation mode: strict or yolo (default: strict)
  --clean            When used with destroy, also removes .agents/flow/archived
  -h, --help         Show this help message
  -v, --version      Print version and exit

Examples:
  nvst define requirement --agent ide
  nvst create project-context --agent ide
  nvst create prototype --agent ide --iterations 1`);
}

async function printVersion(): Promise<void> {
  if (typeof NVST_COMPILED_VERSION === "string" && NVST_COMPILED_VERSION.length > 0) {
    console.log(NVST_COMPILED_VERSION);
    return;
  }

  const pkgPath = join(import.meta.dir, "..", "package.json");
  try {
    const pkg = (await Bun.file(pkgPath).json()) as { version?: string };
    console.log(pkg?.version ?? "unknown");
  } catch {
    console.log("unknown");
  }
}

async function main() {
  const [, , command, ...args] = process.argv;

  if (command === "-v" || command === "--version") {
    await printVersion();
    return;
  }

  if (!command || command === "-h" || command === "--help" || command === "help") {
    buildHelpProgram().outputHelp();
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    const helpProgram = buildHelpProgram();
    const subArg = args.find((a) => !a.startsWith("-"));
    if (subArg) {
      const subCmd = findCommand(helpProgram, [command, subArg]);
      if (subCmd) { subCmd.outputHelp(); return; }
    }
    const topCmd = findCommand(helpProgram, [command]);
    if (topCmd) { topCmd.outputHelp(); return; }
    helpProgram.outputHelp();
    return;
  }

  if (command === "init") {
    if (args.length > 0) {
      console.error(`Unknown option(s) for init: ${args.join(" ")}`);
      printUsage();
      process.exitCode = 1;
      return;
    }
    await runInit();
    return;
  }

  if (command === "destroy") {
    const clean = args.includes("--clean");
    const unknownArgs = args.filter((arg) => arg !== "--clean");
    if (unknownArgs.length > 0) {
      console.error(`Unknown option(s) for destroy: ${unknownArgs.join(" ")}`);
      printUsage();
      process.exitCode = 1;
      return;
    }
    await runDestroy({ clean });
    return;
  }

  if (command === "start") {
    if (args.length === 0 || args[0] !== "iteration") {
      console.error("Usage for start: nvst start iteration");
      printUsage();
      process.exitCode = 1;
      return;
    }
    const unknownArgs = args.slice(1);
    if (unknownArgs.length > 0) {
      console.error(`Unknown option(s) for start iteration: ${unknownArgs.join(" ")}`);
      printUsage();
      process.exitCode = 1;
      return;
    }
    await runStartIteration();
    return;
  }

  if (command === "ideate") {
    try {
      const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args);
      const { force, remainingArgs: postForceArgs } = parseForce(postAgentArgs);
      if (postForceArgs.length > 0) {
        console.error(`Unknown option(s) for ideate: ${postForceArgs.join(" ")}`);
        printUsage();
        process.exitCode = 1;
        return;
      }

      await runIdeate({ provider, force });
      return;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      printUsage();
      process.exitCode = 1;
      return;
    }
  }

  if (command === "define") {
    if (args.length === 0) {
      console.error("Usage for define: nvst define requirement --agent <provider>");
      printUsage();
      process.exitCode = 1;
      return;
    }

    const subcommand = args[0];
    if (subcommand === "requirement") {
      try {
        const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));
        const { force, remainingArgs: postForceArgs } = parseForce(postAgentArgs);
        if (postForceArgs.length > 0) {
          console.error(`Unknown option(s) for define requirement: ${postForceArgs.join(" ")}`);
          printUsage();
          process.exitCode = 1;
          return;
        }

        await runDefineRequirement({ provider, force });
        return;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        printUsage();
        process.exitCode = 1;
        return;
      }
    }

    console.error(`Unknown define subcommand: ${subcommand}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === "refine") {
    if (args.length === 0) {
      console.error(
        "Usage for refine: nvst refine <requirement|project-context> --agent <provider> [--challenge] [--force]",
      );
      printUsage();
      process.exitCode = 1;
      return;
    }

    const subcommand = args[0];
    if (subcommand === "requirement") {
      try {
        const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));
        const { force, remainingArgs: postForceArgs } = parseForce(postAgentArgs);
        const challenge = postForceArgs.includes("--challenge");
        const unknownArgs = postForceArgs.filter((arg) => arg !== "--challenge");

        if (unknownArgs.length > 0) {
          console.error(`Unknown option(s) for refine requirement: ${unknownArgs.join(" ")}`);
          printUsage();
          process.exitCode = 1;
          return;
        }

        await runRefineRequirement({ provider, challenge, force });
        return;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        printUsage();
        process.exitCode = 1;
        return;
      }
    }

    if (subcommand === "project-context") {
      try {
        const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));
        const { force, remainingArgs: postForceArgs } = parseForce(postAgentArgs);
        const challenge = postForceArgs.includes("--challenge");
        const unknownArgs = postForceArgs.filter((arg) => arg !== "--challenge");

        if (unknownArgs.length > 0) {
          console.error(`Unknown option(s) for refine project-context: ${unknownArgs.join(" ")}`);
          printUsage();
          process.exitCode = 1;
          return;
        }

        await runRefineProjectContext({ provider, challenge, force });
        return;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        printUsage();
        process.exitCode = 1;
        return;
      }
    }

    console.error(`Unknown refine subcommand: ${subcommand}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === "create") {
    if (args.length === 0) {
      console.error(
        "Usage for create: nvst create <prototype|project-context> ...",
      );
      printUsage();
      process.exitCode = 1;
      return;
    }

    const subcommand = args[0];
    if (subcommand === "prototype") {
      try {
        const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));

        const {
          value: iterations,
          remainingArgs: postIterationsArgs,
        } = parseOptionalIntegerFlag(postAgentArgs, "--iterations", 1);
        const {
          value: retryOnFail,
          remainingArgs: postRetryArgs,
        } = parseOptionalIntegerFlag(postIterationsArgs, "--retry-on-fail", 0);

        const { force, remainingArgs: postForceArgs } = parseForce(postRetryArgs);
        const stopOnCritical = postForceArgs.includes("--stop-on-critical");
        const unknownArgs = postForceArgs.filter((arg) => arg !== "--stop-on-critical");
        if (unknownArgs.length > 0) {
          console.error(`Unknown option(s) for create prototype: ${unknownArgs.join(" ")}`);
          printUsage();
          process.exitCode = 1;
          return;
        }

        await runCreatePrototype({ provider, iterations, retryOnFail, stopOnCritical, force });
        return;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        printUsage();
        process.exitCode = 1;
        return;
      }
    }

    if (subcommand === "project-context") {
      try {
        const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));
        const { mode, remainingArgs: postModeArgs } = parseProjectContextMode(postAgentArgs);
        const { force, remainingArgs: postForceArgs } = parseForce(postModeArgs);
        if (postForceArgs.length > 0) {
          console.error(`Unknown option(s) for create project-context: ${postForceArgs.join(" ")}`);
          printUsage();
          process.exitCode = 1;
          return;
        }

        await runCreateProjectContext({ provider, mode, force });
        return;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        printUsage();
        process.exitCode = 1;
        return;
      }
    }

    console.error(`Unknown create subcommand: ${subcommand}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === "audit") {
    if (args.length === 0) {
      console.error("Usage for audit: nvst audit prototype --agent <provider> [--force]");
      printUsage();
      process.exitCode = 1;
      return;
    }

    const subcommand = args[0];
    if (subcommand === "prototype") {
      try {
        const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));
        const { force, remainingArgs: postForceArgs } = parseForce(postAgentArgs);
        if (postForceArgs.length > 0) {
          console.error(`Unknown option(s) for audit prototype: ${postForceArgs.join(" ")}`);
          printUsage();
          process.exitCode = 1;
          return;
        }

        await runAuditPrototype({ provider, force });
        return;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        printUsage();
        process.exitCode = 1;
        return;
      }
    }

    console.error(`Unknown audit subcommand: ${subcommand}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === "refactor") {
    if (args.length === 0) {
      console.error("Usage for refactor: nvst refactor prototype --agent <provider> [--force]");
      printUsage();
      process.exitCode = 1;
      return;
    }

    const subcommand = args[0];
    if (subcommand === "prototype") {
      try {
        const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));
        const { force, remainingArgs: postForceArgs } = parseForce(postAgentArgs);
        if (postForceArgs.length > 0) {
          console.error(`Unknown option(s) for refactor prototype: ${postForceArgs.join(" ")}`);
          printUsage();
          process.exitCode = 1;
          return;
        }

        await runRefactorPrototype({ provider, force });
        return;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        printUsage();
        process.exitCode = 1;
        return;
      }
    }

    console.error(`Unknown refactor subcommand: ${subcommand}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === "approve") {
    if (args.length === 0) {
      console.error("Usage for approve: nvst approve <requirement|project-context|prototype> [--force]");
      printUsage();
      process.exitCode = 1;
      return;
    }

    const subcommand = args[0];
    const { force, remainingArgs: unknownArgs } = parseForce(args.slice(1));
    if (unknownArgs.length > 0) {
      console.error(`Unknown option(s) for approve ${subcommand}: ${unknownArgs.join(" ")}`);
      printUsage();
      process.exitCode = 1;
      return;
    }

    if (subcommand === "requirement") {
      await runApproveRequirement({ force });
      return;
    }

    if (subcommand === "prototype") {
      await runApprovePrototype({ force });
      return;
    }

    if (subcommand === "project-context") {
      await runApproveProjectContext({ force });
      return;
    }

    console.error(`Unknown approve subcommand: ${subcommand}`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === "sync") {
    if (args.length === 0 || args[0] !== "skills") {
      console.error("Usage for sync: nvst sync skills");
      printUsage();
      process.exitCode = 1;
      return;
    }
    const unknownArgs = args.slice(1);
    if (unknownArgs.length > 0) {
      console.error(`Unknown option(s) for sync skills: ${unknownArgs.join(" ")}`);
      printUsage();
      process.exitCode = 1;
      return;
    }
    await runSyncAgentSkills();
    return;
  }

  if (command === "write-json") {
    await runWriteJson({ args });
    return;
  }

  if (command === "write-technical-debt") {
    await runWriteTechnicalDebt({ args });
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exitCode = 1;
}

main().catch((error) => {
  if (error instanceof GuardrailAbortError) {
    // exitCode already set and "Aborted." already written by assertGuardrail
    return;
  }
  console.error("nvst failed:", error);
  process.exitCode = 1;
});
