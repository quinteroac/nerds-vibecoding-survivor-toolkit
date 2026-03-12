import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("CLI usage text", () => {
  test("help includes the prototype audit command", async () => {
    const source = await readFile(join(import.meta.dir, "cli.ts"), "utf8");
    expect(source).toContain("audit prototype --agent <provider> [--force]");
  });
});
