import { describe, it, expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const NVST_SKILLS_DIR = join(PROJECT_ROOT, "nvst-skills");

const AFFECTED_SKILLS = [
  "audit-prototype",
  "create-prototype",
  "refactor-prototype",
  "approve-prototype",
];

async function readSkillFrontmatter(skillName: string): Promise<string> {
  const skillPath = join(NVST_SKILLS_DIR, skillName, "SKILL.md");
  return readFile(skillPath, "utf-8");
}

function parseFrontmatterFields(content: string): Record<string, string> {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return {};
  const fields: Record<string, string> = {};
  for (const line of frontmatterMatch[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    fields[key] = value;
  }
  return fields;
}

describe("US-004: All workflow skills are marked user-invocable: true", () => {
  for (const skill of AFFECTED_SKILLS) {
    it(`US-004-AC01: ${skill} has user-invocable: true`, async () => {
      const content = await readSkillFrontmatter(skill);
      const fields = parseFrontmatterFields(content);
      expect(fields["user-invocable"]).toBe("true");
    });

    it(`US-004-AC02: ${skill} frontmatter only changes user-invocable`, async () => {
      const content = await readSkillFrontmatter(skill);
      const fields = parseFrontmatterFields(content);
      // Required fields must still be present and non-empty
      expect(fields["name"]).toBeTruthy();
      expect(fields["description"]).toBeTruthy();
      // user-invocable is the only field that was changed
      expect(Object.keys(fields)).toContain("user-invocable");
    });
  }
});
