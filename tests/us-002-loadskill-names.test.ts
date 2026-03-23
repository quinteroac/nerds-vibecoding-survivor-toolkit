import { describe, it, expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readdir } from "node:fs/promises";

const SRC_COMMANDS = join(import.meta.dir, "..", "src", "commands");

async function readCommand(name: string): Promise<string> {
  return readFile(join(SRC_COMMANDS, `${name}.ts`), "utf8");
}

describe("US-002: loadSkill() calls use the command's own file name as skill name", () => {
  // US-002-AC01
  it("AC01: define-requirement.ts calls loadSkill with 'define-requirement'", async () => {
    const src = await readCommand("define-requirement");
    expect(src).toContain('"define-requirement"');
    expect(src).not.toContain('"create-pr-document"');
  });

  // US-002-AC02
  it("AC02: refine-requirement.ts calls loadSkill with 'refine-requirement'", async () => {
    const src = await readCommand("refine-requirement");
    expect(src).toContain('"refine-requirement"');
    expect(src).not.toContain('"refine-pr-document"');
  });

  // US-002-AC03
  it("AC03: create-prototype.ts calls loadSkill with 'create-prototype'", async () => {
    const src = await readCommand("create-prototype");
    expect(src).toContain('"create-prototype"');
    expect(src).not.toContain('"implement-user-story"');
  });

  // US-002-AC04: No source command files pass old skill names to loadSkill
  it("AC04: no command handler passes old skill names to loadSkill", async () => {
    const oldNames = ["create-pr-document", "refine-pr-document", "implement-user-story"];
    const files = await readdir(SRC_COMMANDS);
    const tsFiles = files.filter((f) => f.endsWith(".ts"));

    for (const file of tsFiles) {
      const src = await readFile(join(SRC_COMMANDS, file), "utf8");
      for (const oldName of oldNames) {
        // Check that no loadSkill call uses the old name
        const loadSkillPattern = new RegExp(`loadSkill[^"]*"${oldName}"`);
        const loadSkillFnPattern = new RegExp(`loadSkillFn[^"]*"${oldName}"`);
        expect(
          loadSkillPattern.test(src) || loadSkillFnPattern.test(src),
          `${file} references old skill name "${oldName}"`,
        ).toBe(false);
      }
    }
  });

  // US-002-AC05: Typecheck passes
  it("AC05: typecheck passes without errors", async () => {
    const proc = Bun.spawn(["bun", "tsc", "--noEmit"], {
      cwd: join(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    if (proc.exitCode !== 0) {
      console.error("TypeScript errors:", stderr);
    }
    expect(proc.exitCode).toBe(0);
  }, 60_000);
});
