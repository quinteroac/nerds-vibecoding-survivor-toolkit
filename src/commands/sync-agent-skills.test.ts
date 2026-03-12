import { describe, expect, test } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { runSyncAgentSkills } from "./sync-agent-skills";

const PROJECT_ROOT = process.cwd();

describe("sync-agent-skills", () => {
  test("US-003-AC01: after sync, prompt/skill files are identical in .agents/skills/ and scaffold/.agents/skills/", async () => {
    await runSyncAgentSkills(PROJECT_ROOT);

    const runtimeDir = join(PROJECT_ROOT, ".agents", "skills");
    const scaffoldDir = join(PROJECT_ROOT, "scaffold", ".agents", "skills");
    const entries = await readdir(runtimeDir, { withFileTypes: true });
    const skillNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    for (const name of skillNames) {
      const runtimePath = join(runtimeDir, name, "SKILL.md");
      const scaffoldPath = join(scaffoldDir, name, "tmpl_SKILL.md");
      const [runtimeContent, scaffoldContent] = await Promise.all([
        readFile(runtimePath, "utf8"),
        readFile(scaffoldPath, "utf8"),
      ]);
      expect(
        scaffoldContent,
        `.agents/skills/${name}/SKILL.md and scaffold/.agents/skills/${name}/tmpl_SKILL.md must be identical`,
      ).toBe(runtimeContent);
    }
  });
});
