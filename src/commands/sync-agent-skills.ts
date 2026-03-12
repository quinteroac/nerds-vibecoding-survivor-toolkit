import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const RUNTIME_SKILLS_DIR = ".agents/skills";
const SCAFFOLD_SKILLS_DIR = "scaffold/.agents/skills";
const SKILL_FILE = "SKILL.md";
const SCAFFOLD_SKILL_FILE = "tmpl_SKILL.md";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Syncs agent skill files from runtime `.agents/skills/` to scaffold
 * `scaffold/.agents/skills/` so both locations stay identical. Each
 * `.agents/skills/<name>/SKILL.md` is written to
 * `scaffold/.agents/skills/<name>/tmpl_SKILL.md`.
 *
 * @param projectRoot - Project root (defaults to process.cwd())
 */
export async function runSyncAgentSkills(projectRoot: string = process.cwd()): Promise<void> {
  const runtimeDir = join(projectRoot, RUNTIME_SKILLS_DIR);
  const scaffoldDir = join(projectRoot, SCAFFOLD_SKILLS_DIR);

  const entries = await readdir(runtimeDir, { withFileTypes: true });
  const skillNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (skillNames.length === 0) {
    console.log("No skills found in .agents/skills/ — nothing to sync.");
    return;
  }

  let synced = 0;
  for (const name of skillNames) {
    const sourcePath = join(runtimeDir, name, SKILL_FILE);
    if (!(await fileExists(sourcePath))) {
      console.warn(`Skipping ${name}: SKILL.md not found.`);
      continue;
    }
    const content = await readFile(sourcePath, "utf8");
    const destDir = join(scaffoldDir, name);
    const destPath = join(destDir, SCAFFOLD_SKILL_FILE);
    await mkdir(destDir, { recursive: true });
    await writeFile(destPath, content, "utf8");
    console.log(`Synced: .agents/skills/${name}/SKILL.md → scaffold/.agents/skills/${name}/tmpl_SKILL.md`);
    synced++;
  }

  console.log(`\nSync complete. ${synced} skill(s) updated in scaffold.`);
}
