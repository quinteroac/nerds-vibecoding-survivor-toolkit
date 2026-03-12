import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { runApprovePrototype } from "./approve-prototype";

describe("approve prototype command", () => {
  test("registers approve prototype command in CLI dispatch", async () => {
    const source = await readFile(join(process.cwd(), "src", "cli.ts"), "utf8");

    expect(source).toContain('import { runApprovePrototype } from "./commands/approve-prototype";');
    expect(source).toContain('if (subcommand === "prototype") {');
    expect(source).toContain("await runApprovePrototype({ force });");
  });

  test("prints not implemented placeholder message without throwing", async () => {
    const logs: string[] = [];

    await expect(
      runApprovePrototype({}, {
        logFn: (message) => {
          logs.push(message);
        },
      }),
    ).resolves.toBeUndefined();

    expect(logs).toEqual(["nvst approve prototype is not implemented yet."]);
  });
});
