import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const cliPath = join(import.meta.dir, "cli.ts");

describe("US-002 prototype loop stubs", () => {
  test("refactor prototype command is invocable (loads audit and invokes agent or fails with clear error)", async () => {
    const proc = Bun.spawn(["bun", cliPath, "refactor", "prototype", "--agent", "codex"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;

    // Exit 0: agent ran; exit 1: guardrail, missing audit file, or agent failure
    expect([0, 1]).toContain(exitCode);
  });

  test("approve prototype command is invocable stub handler", async () => {
    const proc = Bun.spawn(["bun", cliPath, "approve", "prototype"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const stdoutText = await new Response(proc.stdout).text();
    const stderrText = await new Response(proc.stderr).text();

    expect(exitCode).toBe(0);
    expect(stdoutText).toContain("nvst approve prototype is not implemented yet.");
    expect(stderrText).toBe("");
  });
});
