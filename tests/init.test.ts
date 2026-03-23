import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit, type InitDeps } from "../src/commands/init";

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-init-test-"));
}

describe("runInit – US-001", () => {
  let tmpDir: string;
  let originalCwd: string;
  let originalExitCode: number | undefined;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
    originalCwd = process.cwd();
    process.chdir(tmpDir);
    originalExitCode = process.exitCode as number | undefined;
    process.exitCode = 0;
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.exitCode = originalExitCode;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("US-001-AC01: runInit does not present its own project-vs-global scope prompt", async () => {
    // The installer is a no-op; capture console output to verify no scope prompt is printed.
    const logMessages: string[] = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = (msg: string) => logMessages.push(msg);
    console.warn = (msg: string) => logMessages.push(msg);

    const deps: InitDeps = { skillsInstallerFn: async () => 0 };
    await runInit(deps);

    console.log = originalLog;
    console.warn = originalWarn;

    const combined = logMessages.join("\n").toLowerCase();
    // Ensure no own scope/install prompt is emitted by runInit itself.
    expect(combined).not.toContain("global");
    expect(combined).not.toContain("scope");
    expect(combined).not.toContain("choose");
  });

  it("US-001-AC02: runInit invokes skillsInstallerFn so the npx skills add flow is presented", async () => {
    let installerCalled = false;
    let installerCwd: string | undefined;

    const deps: InitDeps = {
      skillsInstallerFn: async (projectRoot) => {
        installerCalled = true;
        installerCwd = projectRoot;
        return 0;
      },
    };

    await runInit(deps);

    expect(installerCalled).toBe(true);
    expect(installerCwd).toBe(tmpDir);
  });

  it("US-001-AC03: when skillsInstallerFn returns non-zero (user aborted), runInit exits cleanly without throwing", async () => {
    const deps: InitDeps = {
      skillsInstallerFn: async () => 130, // SIGINT exit code
    };

    // Must not throw
    await expect(runInit(deps)).resolves.toBeUndefined();

    // Must signal non-zero exit via process.exitCode, not via exception
    expect(process.exitCode).not.toBe(0);
  });

  it("US-001-AC03: when skillsInstallerFn returns null (killed by signal), runInit exits cleanly", async () => {
    const deps: InitDeps = {
      skillsInstallerFn: async () => null,
    };

    await expect(runInit(deps)).resolves.toBeUndefined();
    expect(process.exitCode).not.toBe(0);
  });

  it("US-001-AC02+AC03: when skillsInstallerFn succeeds (exit 0), process.exitCode stays 0", async () => {
    const deps: InitDeps = {
      skillsInstallerFn: async () => 0,
    };

    await runInit(deps);

    expect(process.exitCode).toBe(0);
  });
});
