import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { runAuditPrototype } from "./audit-prototype";

describe("audit prototype command", () => {
  test("registers audit prototype command in CLI dispatch", async () => {
    const source = await readFile(join(process.cwd(), "src", "cli.ts"), "utf8");

    expect(source).toContain('import { runAuditPrototype } from "./commands/audit-prototype";');
    expect(source).toContain('if (command === "audit") {');
    expect(source).toContain('if (subcommand === "prototype") {');
    expect(source).toContain("await runAuditPrototype({ provider, force });");
  });

  test("prints not implemented placeholder message without throwing", async () => {
    const logs: string[] = [];

    await expect(
      runAuditPrototype(
        { provider: "codex" },
        {
          logFn: (message) => {
            logs.push(message);
          },
        },
      ),
    ).resolves.toBeUndefined();

    expect(logs).toEqual(["nvst audit prototype is not implemented yet."]);
  });

  test("builds and invokes full prompt for ide provider", async () => {
    const prompts: string[] = [];

    await expect(
      runAuditPrototype(
        { provider: "ide" },
        {
          loadSkillFn: async () => "# Audit Skill",
          readIterationFn: async () => "000023",
          invokeAgentFn: async (options) => {
            prompts.push(options.prompt);
            return { exitCode: 0, stdout: "", stderr: "" };
          },
        },
      ),
    ).resolves.toBeUndefined();

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("# Audit Skill");
    expect(prompts[0]).toContain("### iteration");
    expect(prompts[0]).toContain("000023");
  });
});
