import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const cliPath = join(import.meta.dir, "cli.ts");

describe("US-001: CLI surface matches the new loop", () => {
  test("US-001-AC01: cli.ts routes all explicit main-loop commands", async () => {
    const source = await readFile(cliPath, "utf8");

    expect(source).toContain('if (command === "define")');
    expect(source).toContain('if (subcommand === "requirement")');
    expect(source).toContain("await runDefineRequirement({ provider, force });");

    expect(source).toContain('if (command === "refine")');
    expect(source).toContain("await runRefineRequirement({ provider, challenge, force });");

    expect(source).toContain('if (command === "approve")');
    expect(source).toContain("await runApproveRequirement({ force });");

    expect(source).toContain('if (command === "create")');
    expect(source).toContain("await runCreatePrototype({ provider, iterations, retryOnFail, stopOnCritical, force });");

    expect(source).toContain('if (command === "audit")');
    expect(source).toContain("await runAuditPrototype({ provider, force });");

    expect(source).toContain('if (command === "refactor")');
    expect(source).toContain("await runRefactorPrototype({ provider, force });");

    expect(source).toContain("await runApprovePrototype({ force });");
  });

  test("US-001-AC02 + US-001-AC05: help includes only retained utilities alongside main workflow", async () => {
    const proc = Bun.spawn(["bun", cliPath, "--help"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const stdoutText = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdoutText).toContain("Primary workflow:");
    expect(stdoutText).toContain("define requirement --agent <provider> [--force]");
    expect(stdoutText).toContain("refine requirement --agent <provider> [--challenge] [--force]");
    expect(stdoutText).toContain("approve requirement [--force]");
    expect(stdoutText).toContain("create prototype --agent <provider>");
    expect(stdoutText).toContain("audit prototype --agent <provider> [--force]");
    expect(stdoutText).toContain("refactor prototype --agent <provider> [--force]");
    expect(stdoutText).toContain("approve prototype [--force]");

    expect(stdoutText).toContain("Utilities:");
    expect(stdoutText).toContain("init");
    expect(stdoutText).toContain("destroy [--clean]");
    expect(stdoutText).toContain("write-json --schema <name> --out <path> [--data '<json>']");
    expect(stdoutText).toContain("write-technical-debt");
  });

  test("US-001-AC03 + US-001-AC04: legacy commands are absent from help", async () => {
    const proc = Bun.spawn(["bun", cliPath, "--help"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdoutText = await new Response(proc.stdout).text();

    expect(stdoutText).not.toContain("create test-plan");
    expect(stdoutText).not.toContain("refine test-plan");
    expect(stdoutText).not.toContain("approve test-plan");
    expect(stdoutText).not.toContain("define refactor-plan");
    expect(stdoutText).not.toContain("refine refactor-plan");
    expect(stdoutText).not.toContain("approve refactor-plan");
    expect(stdoutText).not.toContain("flow [--agent <provider>] [--force]");
    expect(stdoutText).not.toContain("create issue");
    expect(stdoutText).not.toContain("execute automated-fix");
    expect(stdoutText).not.toContain("execute manual-fix");
    expect(stdoutText).not.toContain("create project-context");
    expect(stdoutText).not.toContain("refine project-context");
    expect(stdoutText).not.toContain("approve project-context");
  });

  test("US-001-AC06: removed command names fail with clear routing errors", async () => {
    const removedCommands: Array<{ args: string[]; expected: string }> = [
      { args: ["create", "test-plan", "--agent", "codex"], expected: "Unknown create subcommand: test-plan" },
      { args: ["define", "refactor-plan", "--agent", "codex"], expected: "Unknown define subcommand: refactor-plan" },
      { args: ["refine", "test-plan", "--agent", "codex"], expected: "Unknown refine subcommand: test-plan" },
      { args: ["approve", "refactor-plan"], expected: "Unknown approve subcommand: refactor-plan" },
      { args: ["execute", "test-plan", "--agent", "codex"], expected: "Unknown command: execute" },
      { args: ["flow", "--agent", "codex"], expected: "Unknown command: flow" },
    ];

    for (const removed of removedCommands) {
      const proc = Bun.spawn(["bun", cliPath, ...removed.args], {
        stdout: "pipe",
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      const stderrText = await new Response(proc.stderr).text();

      expect(exitCode).toBe(1);
      expect(stderrText).toContain(removed.expected);
    }
  });
});
