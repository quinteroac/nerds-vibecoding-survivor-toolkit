import { describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_BINARY_TARGETS,
  parseBuildBinariesArgs,
  targetToOutputSuffix,
} from "../src/scripts/build-binaries";

describe("build-binaries script", () => {
  it("defines a default target matrix for macOS, Linux, and Windows", () => {
    expect(DEFAULT_BINARY_TARGETS).toEqual([
      "bun-darwin-x64",
      "bun-linux-x64",
      "bun-windows-x64",
    ]);
  });

  it("parses options and rejects unknown arguments", () => {
    const parsed = parseBuildBinariesArgs([
      "--outdir",
      "dist-custom",
      "--name",
      "nvst-custom",
      "--entry",
      "src/cli.ts",
    ]);

    expect(parsed).toEqual({
      outdir: "dist-custom",
      name: "nvst-custom",
      entry: "src/cli.ts",
    });

    expect(() => parseBuildBinariesArgs(["--unknown"]))
      .toThrow("Unknown option: --unknown");
  });

  it("derives predictable platform suffixes from Bun targets", () => {
    expect(targetToOutputSuffix("bun-darwin-x64")).toBe("darwin-x64");
    expect(targetToOutputSuffix("bun-linux-x64")).toBe("linux-x64");
    expect(targetToOutputSuffix("bun-windows-x64")).toBe("windows-x64");
    expect(() => targetToOutputSuffix("linux-x64")).toThrow("Unsupported Bun target format");
  });

  it("builds all platform binaries via one command with predictable output names", async () => {
    const outdir = await mkdtemp(join(tmpdir(), "nvst-build-binaries-test-"));
    const proc = Bun.spawn(["bun", "run", "build:binaries", "--outdir", outdir], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (proc.exitCode !== 0) {
      throw new Error(`build:binaries failed (${proc.exitCode})\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    }

    const entries = await readdir(outdir);
    const expected = ["nvst-darwin-x64", "nvst-linux-x64", "nvst-windows-x64.exe"];

    expect(entries.filter((entry) => expected.includes(entry)).sort()).toEqual(expected);

    for (const filename of expected) {
      const artifactStats = await stat(join(outdir, filename));
      expect(artifactStats.isFile()).toBe(true);
      expect(artifactStats.size).toBeGreaterThan(0);
    }

    expect(stdout).toContain("Built binaries:");
    expect(stdout).toContain(join(outdir, "nvst-darwin-x64"));
    expect(stdout).toContain(join(outdir, "nvst-linux-x64"));
    expect(stdout).toContain(join(outdir, "nvst-windows-x64.exe"));

    await rm(outdir, { recursive: true, force: true });
  }, 120_000);
});
