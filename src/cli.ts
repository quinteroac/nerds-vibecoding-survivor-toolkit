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
      buildHelpProgram().outputHelp();
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
      buildHelpProgram().outputHelp();
      process.exitCode = 1;
      return;
    }
    await runDestroy({ clean });
    return;
  }

  if (command === "start") {
    if (args.length === 0 || args[0] !== "iteration") {
      console.error("Usage for start: nvst start iteration");
      buildHelpProgram().outputHelp();
      process.exitCode = 1;
      return;
    }
    const unknownArgs = args.slice(1);
    if (unknownArgs.length > 0) {
      console.error(`Unknown option(s) for start iteration: ${unknownArgs.join(" ")}`);
      buildHelpProgram().outputHelp();
      process.exitCode = 1;
      return;
    }
    await runStartIteration();
    return;
  }

  if (command === "ideate") {
    try {
      const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args);
      const force = postAgentArgs.includes("--force");
      const postForceArgs = postAgentArgs.filter((a) => a !== "--force");
      if (postForceArgs.length > 0) {
        console.error(`Unknown option(s) for ideate: ${postForceArgs.join(" ")}`);
        buildHelpProgram().outputHelp();
        process.exitCode = 1;
        return;
      }

      await runIdeate({ provider, force });
      return;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      buildHelpProgram().outputHelp();
      process.exitCode = 1;
      return;
    }
  }

  if (command === "define") {
    if (args.length === 0) {
      console.error("Usage for define: nvst define requirement --agent <provider>");
      buildHelpProgram().outputHelp();
      process.exitCode = 1;
      return;
    }

    const subcommand = args[0];
    if (subcommand === "requirement") {
      try {
        const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));
        const force = postAgentArgs.includes("--force");
        const postForceArgs = postAgentArgs.filter((a) => a !== "--force");
        if (postForceArgs.length > 0) {
          console.error(`Unknown option(s) for define requirement: ${postForceArgs.join(" ")}`);
          buildHelpProgram().outputHelp();
          process.exitCode = 1;
          return;
        }

        await runDefineRequirement({ provider, force });
        return;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        buildHelpProgram().outputHelp();
        process.exitCode = 1;
        return;
      }
    }

    console.error(`Unknown define subcommand: ${subcommand}`);
    buildHelpProgram().outputHelp();
    process.exitCode = 1;
    return;
  }

  if (command === "refine") {
    if (args.length === 0) {
      console.error(
        "Usage for refine: nvst refine <requirement|project-context> --agent <provider> [--challenge] [--force]",
      );
      buildHelpProgram().outputHelp();
      process.exitCode = 1;
      return;
    }

    const subcommand = args[0];
    if (subcommand === "requirement") {
      try {
        const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));
        const force = postAgentArgs.includes("--force");
        const postForceArgs = postAgentArgs.filter((a) => a !== "--force");
        const challenge = postForceArgs.includes("--challenge");
        const unknownArgs = postForceArgs.filter((arg) => arg !== "--challenge");

        if (unknownArgs.length > 0) {
          console.error(`Unknown option(s) for refine requirement: ${unknownArgs.join(" ")}`);
          buildHelpProgram().outputHelp();
          process.exitCode = 1;
          return;
        }

        await runRefineRequirement({ provider, challenge, force });
        return;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        buildHelpProgram().outputHelp();
        process.exitCode = 1;
        return;
      }
    }

    if (subcommand === "project-context") {
      try {
        const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));
        const force = postAgentArgs.includes("--force");
        const postForceArgs = postAgentArgs.filter((a) => a !== "--force");
        const challenge = postForceArgs.includes("--challenge");
        const unknownArgs = postForceArgs.filter((arg) => arg !== "--challenge");

        if (unknownArgs.length > 0) {
          console.error(`Unknown option(s) for refine project-context: ${unknownArgs.join(" ")}`);
          buildHelpProgram().outputHelp();
          process.exitCode = 1;
          return;
        }

        await runRefineProjectContext({ provider, challenge, force });
        return;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        buildHelpProgram().outputHelp();
        process.exitCode = 1;
        return;
      }
    }

    console.error(`Unknown refine subcommand: ${subcommand}`);
    buildHelpProgram().outputHelp();
    process.exitCode = 1;
    return;
  }

  if (command === "create") {
    if (args.length === 0) {
      console.error(
        "Usage for create: nvst create <prototype|project-context> ...",
      );
      buildHelpProgram().outputHelp();
      process.exitCode = 1;
      return;
    }

    const subcommand = args[0];
    if (subcommand === "prototype") {
      try {
        const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));

        // --iterations
        const iterIdx = postAgentArgs.indexOf("--iterations");
        let iterations: number | undefined;
        let postIterationsArgs: string[];
        if (iterIdx === -1) {
          iterations = undefined;
          postIterationsArgs = postAgentArgs;
        } else if (iterIdx + 1 >= postAgentArgs.length) {
          throw new Error("Missing value for --iterations.");
        } else {
          const iterVal = Number(postAgentArgs[iterIdx + 1]);
          if (!Number.isInteger(iterVal) || iterVal < 1) {
            throw new Error(`Invalid --iterations value '${postAgentArgs[iterIdx + 1]}'. Expected an integer >= 1.`);
          }
          iterations = iterVal;
          postIterationsArgs = [...postAgentArgs.slice(0, iterIdx), ...postAgentArgs.slice(iterIdx + 2)];
        }

        // --retry-on-fail
        const retryIdx = postIterationsArgs.indexOf("--retry-on-fail");
        let retryOnFail: number | undefined;
        let postRetryArgs: string[];
        if (retryIdx === -1) {
          retryOnFail = undefined;
          postRetryArgs = postIterationsArgs;
        } else if (retryIdx + 1 >= postIterationsArgs.length) {
          throw new Error("Missing value for --retry-on-fail.");
        } else {
          const retryVal = Number(postIterationsArgs[retryIdx + 1]);
          if (!Number.isInteger(retryVal) || retryVal < 0) {
            throw new Error(`Invalid --retry-on-fail value '${postIterationsArgs[retryIdx + 1]}'. Expected an integer >= 0.`);
          }
          retryOnFail = retryVal;
          postRetryArgs = [...postIterationsArgs.slice(0, retryIdx), ...postIterationsArgs.slice(retryIdx + 2)];
        }

        const force = postRetryArgs.includes("--force");
        const postForceArgs = postRetryArgs.filter((a) => a !== "--force");
        const stopOnCritical = postForceArgs.includes("--stop-on-critical");
        const unknownArgs = postForceArgs.filter((arg) => arg !== "--stop-on-critical");
        if (unknownArgs.length > 0) {
          console.error(`Unknown option(s) for create prototype: ${unknownArgs.join(" ")}`);
          buildHelpProgram().outputHelp();
          process.exitCode = 1;
          return;
        }

        await runCreatePrototype({ provider, iterations, retryOnFail, stopOnCritical, force });
        return;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        buildHelpProgram().outputHelp();
        process.exitCode = 1;
        return;
      }
    }

    if (subcommand === "project-context") {
      try {
        const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));

        // --mode
        const modeIdx = postAgentArgs.indexOf("--mode");
        let mode: "strict" | "yolo";
        let postModeArgs: string[];
        if (modeIdx === -1) {
          mode = "strict";
          postModeArgs = postAgentArgs;
        } else if (modeIdx + 1 >= postAgentArgs.length) {
          throw new Error("Missing value for --mode.");
        } else {
          const modeVal = postAgentArgs[modeIdx + 1];
          if (modeVal !== "strict" && modeVal !== "yolo") {
            throw new Error(`Invalid --mode value '${modeVal}'. Expected one of: strict, yolo.`);
          }
          mode = modeVal;
          postModeArgs = [...postAgentArgs.slice(0, modeIdx), ...postAgentArgs.slice(modeIdx + 2)];
        }

        const force = postModeArgs.includes("--force");
        const postForceArgs = postModeArgs.filter((a) => a !== "--force");
        if (postForceArgs.length > 0) {
          console.error(`Unknown option(s) for create project-context: ${postForceArgs.join(" ")}`);
          buildHelpProgram().outputHelp();
          process.exitCode = 1;
          return;
        }

        await runCreateProjectContext({ provider, mode, force });
        return;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        buildHelpProgram().outputHelp();
        process.exitCode = 1;
        return;
      }
    }

    console.error(`Unknown create subcommand: ${subcommand}`);
    buildHelpProgram().outputHelp();
    process.exitCode = 1;
    return;
  }

  if (command === "audit") {
    if (args.length === 0) {
      console.error("Usage for audit: nvst audit prototype --agent <provider> [--force]");
      buildHelpProgram().outputHelp();
      process.exitCode = 1;
      return;
    }

    const subcommand = args[0];
    if (subcommand === "prototype") {
      try {
        const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));
        const force = postAgentArgs.includes("--force");
        const postForceArgs = postAgentArgs.filter((a) => a !== "--force");
        if (postForceArgs.length > 0) {
          console.error(`Unknown option(s) for audit prototype: ${postForceArgs.join(" ")}`);
          buildHelpProgram().outputHelp();
          process.exitCode = 1;
          return;
        }

        await runAuditPrototype({ provider, force });
        return;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        buildHelpProgram().outputHelp();
        process.exitCode = 1;
        return;
      }
    }

    console.error(`Unknown audit subcommand: ${subcommand}`);
    buildHelpProgram().outputHelp();
    process.exitCode = 1;
    return;
  }

  if (command === "refactor") {
    if (args.length === 0) {
      console.error("Usage for refactor: nvst refactor prototype --agent <provider> [--force]");
      buildHelpProgram().outputHelp();
      process.exitCode = 1;
      return;
    }

    const subcommand = args[0];
    if (subcommand === "prototype") {
      try {
        const { provider, remainingArgs: postAgentArgs } = parseAgentArg(args.slice(1));
        const force = postAgentArgs.includes("--force");
        const postForceArgs = postAgentArgs.filter((a) => a !== "--force");
        if (postForceArgs.length > 0) {
          console.error(`Unknown option(s) for refactor prototype: ${postForceArgs.join(" ")}`);
          buildHelpProgram().outputHelp();
          process.exitCode = 1;
          return;
        }

        await runRefactorPrototype({ provider, force });
        return;
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        buildHelpProgram().outputHelp();
        process.exitCode = 1;
        return;
      }
    }

    console.error(`Unknown refactor subcommand: ${subcommand}`);
    buildHelpProgram().outputHelp();
    process.exitCode = 1;
    return;
  }

  if (command === "approve") {
    if (args.length === 0) {
      console.error("Usage for approve: nvst approve <requirement|project-context|prototype> [--force]");
      buildHelpProgram().outputHelp();
      process.exitCode = 1;
      return;
    }

    const subcommand = args[0];
    const argsSlice = args.slice(1);
    const force = argsSlice.includes("--force");
    const unknownArgs = argsSlice.filter((a) => a !== "--force");
    if (unknownArgs.length > 0) {
      console.error(`Unknown option(s) for approve ${subcommand}: ${unknownArgs.join(" ")}`);
      buildHelpProgram().outputHelp();
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
    buildHelpProgram().outputHelp();
    process.exitCode = 1;
    return;
  }

  if (command === "sync") {
    if (args.length === 0 || args[0] !== "skills") {
      console.error("Usage for sync: nvst sync skills");
      buildHelpProgram().outputHelp();
      process.exitCode = 1;
      return;
    }
    const unknownArgs = args.slice(1);
    if (unknownArgs.length > 0) {
      console.error(`Unknown option(s) for sync skills: ${unknownArgs.join(" ")}`);
      buildHelpProgram().outputHelp();
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
  buildHelpProgram().outputHelp();
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
