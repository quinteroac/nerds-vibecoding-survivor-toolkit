import { describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseBuildBinaryArgs, resolveBinaryFilename } from "../src/scripts/build-binary";

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

    await rm(outdir, { recursive: true, force: true });
  });
});
