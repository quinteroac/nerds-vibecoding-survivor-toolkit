import { describe, expect, it } from "bun:test";
import { join } from "node:path";

/**
 * TC-019 (US-004, FR-7): All tests in the project pass (`bun test`); create-prototype tests
 * that hit the dirty-tree path use an injected confirmDirtyTreeCommitFn so they pass in
 * non-TTY environments (e.g. CI). This test runs the create-prototype test file in a
 * subprocess to verify it passes without TTY.
 */
describe("TC-019: create-prototype tests pass without TTY", () => {
  it("TC-019: create-prototype.test.ts passes when run via bun test (non-TTY)", async () => {
    const projectRoot = process.cwd();
    const testPath = join(projectRoot, "src", "commands", "create-prototype.test.ts");

    const proc = Bun.spawn(["bun", "test", testPath], {
      cwd: projectRoot,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    expect(
      exitCode,
      `create-prototype tests should pass (exit 0). stdout: ${stdout.slice(-500)} stderr: ${stderr.slice(-500)}`,
    ).toBe(0);
  });
});
