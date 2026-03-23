import { describe, it, expect } from "bun:test";
import { readdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const SCAFFOLD_SKILLS_DIR = join(PROJECT_ROOT, "scaffold", ".agents", "skills");
const NVST_SKILLS_DIR = join(PROJECT_ROOT, "nvst-skills");

async function dirExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findFiles(dir: string, predicate: (name: string) => boolean): Promise<string[]> {
  const results: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findFiles(fullPath, predicate)));
    } else if (entry.isFile() && predicate(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("US-004: Migrate tmpl_ skill files to nvst-skills", () => {
  it("US-004-AC01: nvst-skills/ contains SKILL.md for every expected NVST skill", async () => {
    const skillDirs = await readdir(NVST_SKILLS_DIR, { withFileTypes: true });
    const skillNames = skillDirs.filter((e) => e.isDirectory()).map((e) => e.name);

    expect(skillNames.length).toBeGreaterThan(0);

    for (const name of skillNames) {
      const skillFile = join(NVST_SKILLS_DIR, name, "SKILL.md");
      const exists = await dirExists(skillFile);
      expect(exists).toBe(true);
    }
  });

  it("US-004-AC02: scaffold/.agents/skills/ contains no tmpl_SKILL.md files", async () => {
    const tmplSkillFiles = await findFiles(
      SCAFFOLD_SKILLS_DIR,
      (name) => name === "tmpl_SKILL.md",
    );
    expect(tmplSkillFiles).toHaveLength(0);
  });

  it("US-004-AC02: scaffold/.agents/skills/ contains no tmpl_ files at all", async () => {
    const tmplFiles = await findFiles(SCAFFOLD_SKILLS_DIR, (name) => name.startsWith("tmpl_"));
    expect(tmplFiles).toHaveLength(0);
  });

  it("US-004-AC03: nvst-skills/ has at least one SKILL.md per NVST framework skill", async () => {
    const skillFiles = await findFiles(NVST_SKILLS_DIR, (name) => name === "SKILL.md");
    // All known NVST skills must have a SKILL.md
    const expectedSkills = [
      "adapt",
      "animate",
      "approve-prototype",
      "audit",
      "audit-prototype",
      "bolder",
      "clarify",
      "colorize",
      "create-pr-document",
      "create-project-context",
      "critique",
      "delight",
      "distill",
      "extract",
      "frontend-design",
      "harden",
      "ideate",
      "implement-user-story",
      "normalize",
      "onboard",
      "optimize",
      "polish",
      "quieter",
      "refactor-prototype",
      "refine-pr-document",
      "refine-project-context",
      "teach-impeccable",
    ];

    for (const skill of expectedSkills) {
      const skillFile = join(NVST_SKILLS_DIR, skill, "SKILL.md");
      const exists = await dirExists(skillFile);
      expect(exists).toBe(true);
    }

    expect(skillFiles.length).toBeGreaterThanOrEqual(expectedSkills.length);
  });
});
