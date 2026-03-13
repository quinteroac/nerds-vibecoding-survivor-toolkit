import { describe, it, expect } from "bun:test";

import { extractFlagValue } from "../src/cli";

describe("extractFlagValue", () => {
  it("returns the flag value and remaining args when the flag is present", () => {
    const args = ["nvst", "create", "--agent", "ide", "--foo", "bar", "baz"];

    const result = extractFlagValue(args, "--foo");

    expect(result.value).toBe("bar");
    expect(result.remainingArgs).toEqual(["nvst", "create", "--agent", "ide", "baz"]);
  });

  it("returns null and original args when the flag is absent", () => {
    const args = ["nvst", "define", "requirement", "--agent", "ide"];

    const result = extractFlagValue(args, "--missing");

    expect(result.value).toBeNull();
    expect(result.remainingArgs).toEqual(args);
  });

  it("throws an error when the flag is present but has no following value", () => {
    const args = ["--foo"];

    expect(() => extractFlagValue(args, "--foo")).toThrow("Missing value for --foo.");
  });
});

describe("CLI routing", () => {
  it("prints an error and usage, and exits with code 1 for an unknown command", async () => {
    const proc = Bun.spawn([process.argv[0], "src/cli.ts", "foobar"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await proc.exited;

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    expect(proc.exitCode).toBe(1);
    expect(stderr).toContain("Unknown command: foobar");
    expect(stdout).toContain("Usage: nvst");
  });
});

