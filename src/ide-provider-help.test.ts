import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const cliPath = join(import.meta.dir, "cli.ts");

describe("US-002: CLI help reflects ide provider", () => {
  test("US-002-AC01: --agent help lists ide with all valid providers", async () => {
    const proc = Bun.spawn(["bun", cliPath, "--help"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const stdoutText = await new Response(proc.stdout).text();

    expect(exitCode).toBe(0);
    expect(stdoutText).toContain("Valid providers: claude, codex, gemini, cursor, copilot, ide");
  });

  test("US-002-AC02: help describes ide as prompt-output mode", async () => {
    const proc = Bun.spawn(["bun", cliPath, "--help"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdoutText = await new Response(proc.stdout).text();

    expect(stdoutText).toContain(
      "ide prints skill prompts to stdout instead of invoking an agent subprocess",
    );
  });

  test("US-002-AC03: help examples show ide as a valid --agent option", async () => {
    const proc = Bun.spawn(["bun", cliPath, "--help"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdoutText = await new Response(proc.stdout).text();

    expect(stdoutText).toContain("nvst define requirement --agent ide");
    expect(stdoutText).toContain("nvst create prototype --agent ide --iterations 1");
  });
});
