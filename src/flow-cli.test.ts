import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("CLI no-flow surface", () => {
  test("help no longer advertises flow command", async () => {
    const source = await readFile(join(import.meta.dir, "cli.ts"), "utf8");
    expect(source).not.toContain("flow [--agent <provider>] [--force]");
  });
});
