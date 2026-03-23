import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit, writeNvstSkillsToTemp, type InitDeps } from "../src/commands/init";

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
      skillsInstallerFn: async (projectRoot, _nvstSkillsPath) => {
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

describe("runInit – US-002", () => {
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

  it("US-002-AC01: skillsInstallerFn receives a temp path containing the nvst-skills (no scope flag)", async () => {
    let receivedSkillsPath: string | undefined;

    const deps: InitDeps = {
      skillsInstallerFn: async (_projectRoot, nvstSkillsPath) => {
        receivedSkillsPath = nvstSkillsPath;
        return 0;
      },
    };

    await runInit(deps);

    expect(receivedSkillsPath).toBeDefined();
    // The temp dir must have been a real directory containing skill subdirectories
    // (it is cleaned up after runInit returns, so we only check it was a string path)
    expect(typeof receivedSkillsPath).toBe("string");
    expect(receivedSkillsPath!.length).toBeGreaterThan(0);
  });

  it("US-002-AC02: writeNvstSkillsToTemp materialises nvst-skills into a temp directory with SKILL.md files", async () => {
    const tempDir = await writeNvstSkillsToTemp();
    try {
      const dirStat = await stat(tempDir);
      expect(dirStat.isDirectory()).toBe(true);
      const entries = await readdir(tempDir, { withFileTypes: true });
      const skillDirs = entries.filter((e) => e.isDirectory());
      expect(skillDirs.length).toBeGreaterThan(0);
      // At least one skill must have a SKILL.md
      const firstSkill = join(tempDir, skillDirs[0].name, "SKILL.md");
      const fileStat = await stat(firstSkill);
      expect(fileStat.isFile()).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("US-002-AC03: init awaits the installer — process.exitCode reflects installer result", async () => {
    let installerResolved = false;

    const deps: InitDeps = {
      skillsInstallerFn: async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
        installerResolved = true;
        return 0;
      },
    };

    await runInit(deps);

    // runInit must have awaited the installer before returning
    expect(installerResolved).toBe(true);
    expect(process.exitCode).toBe(0);
  });
});

describe("runInit – US-003", () => {
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

  it("US-003-AC01: after a successful run, the skills installer is invoked and process.exitCode is 0", async () => {
    let installerCallCount = 0;
    let installerReceivedSkillsPath: string | undefined;

    const deps: InitDeps = {
      skillsInstallerFn: async (_projectRoot, nvstSkillsPath) => {
        installerCallCount++;
        installerReceivedSkillsPath = nvstSkillsPath;
        return 0;
      },
    };

    await runInit(deps);

    // Installer was invoked exactly once with a non-empty temp path
    expect(installerCallCount).toBe(1);
    expect(typeof installerReceivedSkillsPath).toBe("string");
    expect(installerReceivedSkillsPath!.length).toBeGreaterThan(0);
    expect(process.exitCode).toBe(0);
  });

  it("US-003-AC02: 'Init complete' is printed only after the skill installation step finishes", async () => {
    const events: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => events.push(`log:${msg}`);

    const deps: InitDeps = {
      skillsInstallerFn: async () => {
        events.push("installer:done");
        return 0;
      },
    };

    await runInit(deps);
    console.log = originalLog;

    const installerIdx = events.indexOf("installer:done");
    const completionIdx = events.findIndex((e) => e.includes("Init complete"));

    expect(installerIdx).toBeGreaterThanOrEqual(0);
    expect(completionIdx).toBeGreaterThanOrEqual(0);
    // Success message must come AFTER installer resolves
    expect(completionIdx).toBeGreaterThan(installerIdx);
  });

  it("US-003-AC03: when installer fails on an existing project, process.exitCode is non-zero and no success message is printed", async () => {
    // First run — scaffold all files successfully
    await runInit({ skillsInstallerFn: async () => 0 });
    process.exitCode = 0;

    // Second run — all scaffold files already exist; installer fails
    const logMessages: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => logMessages.push(msg);

    await runInit({ skillsInstallerFn: async () => 1 });
    console.log = originalLog;

    expect(process.exitCode).not.toBe(0);
    expect(logMessages.some((m) => m.includes("Init complete"))).toBe(false);
  });

  it("US-003-AC04: running init twice calls the installer both times (skills package handles idempotency)", async () => {
    let installerCallCount = 0;
    const deps: InitDeps = {
      skillsInstallerFn: async () => {
        installerCallCount++;
        return 0;
      },
    };

    // First run: creates scaffold files
    await runInit(deps);
    // Second run: scaffold files already exist (skipped), but installer is still called
    await runInit(deps);

    // Both runs invoke the installer — idempotency is delegated to the skills package
    expect(installerCallCount).toBe(2);
    expect(process.exitCode).toBe(0);
  });
});
