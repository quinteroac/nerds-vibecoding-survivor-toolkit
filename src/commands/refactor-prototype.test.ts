import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { runRefactorPrototype } from "./refactor-prototype";

describe("refactor prototype command", () => {
  test("registers refactor prototype command in CLI dispatch", async () => {
    const source = await readFile(join(process.cwd(), "src", "cli.ts"), "utf8");

    expect(source).toContain('import { runRefactorPrototype } from "./commands/refactor-prototype";');
    expect(source).toContain('if (command === "refactor") {');
    expect(source).toContain('if (subcommand === "prototype") {');
    expect(source).toContain("await runRefactorPrototype({ provider, force });");
  });

  test("prints not implemented placeholder message without throwing", async () => {
    const logs: string[] = [];

    await expect(
      runRefactorPrototype(
        { provider: "gemini" },
        {
          logFn: (message) => {
            logs.push(message);
          },
        },
      ),
    ).resolves.toBeUndefined();

    expect(logs).toEqual(["nvst refactor prototype is not implemented yet."]);
  });
});
