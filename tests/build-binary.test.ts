import { describe, expect, it } from "bun:test";
import { chmod, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseBuildBinaryArgs, resolveBinaryFilename } from "../src/scripts/build-binary";

function withPathWithoutRuntime(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
  env[pathKey] = "";
  return env;
}

describe("build-binary script", () => {
  it("resolves output filename for current and specified platforms", () => {
    const currentPlatformName = resolveBinaryFilename("nvst");
    const expectedCurrent = process.platform === "win32" ? "nvst.exe" : "nvst";
    expect(currentPlatformName).toBe(expectedCurrent);
    expect(resolveBinaryFilename("nvst", "bun-windows-x64")).toBe("nvst.exe");
    expect(resolveBinaryFilename("nvst.exe", "bun-linux-x64")).toBe("nvst");
  });

  it("parses build options and rejects unknown options", () => {
    const parsed = parseBuildBinaryArgs([
      "--target",
      "bun-linux-x64",
      "--outdir",
      "dist-custom",
      "--name",
      "nvst-custom",
      "--entry",
      "src/cli.ts",
    ]);

    expect(parsed).toEqual({
      target: "bun-linux-x64",
      outdir: "dist-custom",
      name: "nvst-custom",
      entry: "src/cli.ts",
    });

    expect(() => parseBuildBinaryArgs(["--unknown"])).toThrow("Unknown option: --unknown");
  });

  it("builds exactly one binary through the reproducible package script", async () => {
    const outdir = await mkdtemp(join(tmpdir(), "nvst-build-binary-test-"));
    const proc = Bun.spawn(["bun", "run", "build:binary", "--outdir", outdir], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (proc.exitCode !== 0) {
      throw new Error(`build:binary failed (${proc.exitCode})\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    }

    const expectedFile = process.platform === "win32" ? "nvst.exe" : "nvst";
    const entries = await readdir(outdir);
    const candidateBinaries = entries.filter((entry) => entry === "nvst" || entry === "nvst.exe");

    expect(candidateBinaries).toEqual([expectedFile]);
    const artifactStats = await stat(join(outdir, expectedFile));
    expect(artifactStats.isFile()).toBe(true);
    expect(artifactStats.size).toBeGreaterThan(0);
    expect(stdout).toContain(`Built binary: ${join(outdir, expectedFile)}`);

    const binaryPath = join(outdir, expectedFile);
    if (process.platform !== "win32") {
      await chmod(binaryPath, 0o755);
    }

    const binaryHelpProc = Bun.spawn([binaryPath, "--help"], {
      cwd: outdir,
      stdout: "pipe",
      stderr: "pipe",
    });
    await binaryHelpProc.exited;
    const binaryHelpStdout = await new Response(binaryHelpProc.stdout).text();
    const binaryHelpStderr = await new Response(binaryHelpProc.stderr).text();

    const sourceHelpProc = Bun.spawn([process.argv[0], "src/cli.ts", "--help"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await sourceHelpProc.exited;
    const sourceHelpStdout = await new Response(sourceHelpProc.stdout).text();
    const sourceHelpStderr = await new Response(sourceHelpProc.stderr).text();

    expect(binaryHelpProc.exitCode).toBe(0);
    expect(binaryHelpStderr).toBe("");
    expect(sourceHelpProc.exitCode).toBe(0);
    expect(sourceHelpStderr).toBe("");
    expect(binaryHelpStdout).toBe(sourceHelpStdout);
    expect(binaryHelpStdout).toContain("Usage: nvst");
    expect(binaryHelpStdout).toContain("define requirement");

    const binaryNoRuntimeProc = Bun.spawn([binaryPath, "--help"], {
      cwd: outdir,
      env: withPathWithoutRuntime(),
      stdout: "pipe",
      stderr: "pipe",
    });
    await binaryNoRuntimeProc.exited;
    const binaryNoRuntimeStdout = await new Response(binaryNoRuntimeProc.stdout).text();
    const binaryNoRuntimeStderr = await new Response(binaryNoRuntimeProc.stderr).text();

    expect(binaryNoRuntimeProc.exitCode).toBe(0);
    expect(binaryNoRuntimeStderr).toBe("");
    expect(binaryNoRuntimeStdout).toContain("Usage: nvst");

    const binaryVersionProc = Bun.spawn([binaryPath, "--version"], {
      cwd: outdir,
      stdout: "pipe",
      stderr: "pipe",
    });
    await binaryVersionProc.exited;
    const binaryVersionStdout = await new Response(binaryVersionProc.stdout).text();
    const binaryVersionStderr = await new Response(binaryVersionProc.stderr).text();

    const sourceVersionProc = Bun.spawn([process.argv[0], "src/cli.ts", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await sourceVersionProc.exited;
    const sourceVersionStdout = await new Response(sourceVersionProc.stdout).text();
    const sourceVersionStderr = await new Response(sourceVersionProc.stderr).text();

    expect(binaryVersionProc.exitCode).toBe(0);
    expect(binaryVersionStderr).toBe("");
    expect(sourceVersionProc.exitCode).toBe(0);
    expect(sourceVersionStderr).toBe("");
    expect(binaryVersionStdout.trim()).toBe(sourceVersionStdout.trim());
    expect(binaryVersionStdout.trim()).not.toBe("");

    await rm(outdir, { recursive: true, force: true });
  });
});
