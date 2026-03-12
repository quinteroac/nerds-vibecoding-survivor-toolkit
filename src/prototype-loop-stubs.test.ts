import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const cliPath = join(import.meta.dir, "cli.ts");

describe("US-002 prototype loop stubs", () => {
  test("audit/refactor/approve prototype commands are invocable stub handlers", async () => {
    const cases: Array<{ args: string[]; expectedMessage: string }> = [
      {
        args: ["audit", "prototype", "--agent", "codex"],
        expectedMessage: "nvst audit prototype is not implemented yet.",
      },
      {
        args: ["refactor", "prototype", "--agent", "codex"],
        expectedMessage: "nvst refactor prototype is not implemented yet.",
      },
      {
        args: ["approve", "prototype"],
        expectedMessage: "nvst approve prototype is not implemented yet.",
      },
    ];

    for (const commandCase of cases) {
      const proc = Bun.spawn(["bun", cliPath, ...commandCase.args], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      const stdoutText = await new Response(proc.stdout).text();
      const stderrText = await new Response(proc.stderr).text();

      expect(exitCode).toBe(0);
      expect(stdoutText).toContain(commandCase.expectedMessage);
      expect(stderrText).toBe("");
    }
  });
});
