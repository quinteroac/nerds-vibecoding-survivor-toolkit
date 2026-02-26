#!/usr/bin/env bun
/**
 * sync-check.ts
 *
 * Verifies that working-copy files in schemas/ and .agents/skills/ are
 * byte-for-byte identical to their canonical scaffold originals.
 *
 * Schemas:  schemas/<name>.ts        ↔  scaffold/schemas/tmpl_<name>.ts
 * Skills:   .agents/skills/<s>/SKILL.md  ↔  scaffold/.agents/skills/<s>/tmpl_SKILL.md
 *
 * Exits with code 1 if any drift is detected.
 */

import { readFile, readdir } from "node:fs/promises";
import { join, extname, basename } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

let drifted = 0;
let checked = 0;

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

async function checkPair(workingPath: string, canonicalPath: string, label: string): Promise<void> {
  if (!(await fileExists(canonicalPath))) {
    console.error(`  MISSING canonical: ${canonicalPath}`);
    drifted++;
    return;
  }

  const [working, canonical] = await Promise.all([
    readFile(workingPath, "utf-8"),
    readFile(canonicalPath, "utf-8"),
  ]);

  checked++;

  if (working !== canonical) {
    console.error(`  DRIFT detected: ${label}`);
    console.error(`    working:   ${workingPath}`);
    console.error(`    canonical: ${canonicalPath}`);
    drifted++;
  } else {
    console.log(`  OK: ${label}`);
  }
}

// ---------------------------------------------------------------------------
// Check schemas/
// ---------------------------------------------------------------------------
console.log("\nChecking schemas/ against scaffold/schemas/...");

const schemasDir = join(ROOT, "schemas");
const scaffoldSchemasDir = join(ROOT, "scaffold", "schemas");

try {
  const schemaFiles = await readdir(schemasDir);
  const schemaSourceFiles = schemaFiles.filter(
    (f) => extname(f) === ".ts" && !f.endsWith(".test.ts"),
  );

  if (schemaSourceFiles.length === 0) {
    console.log("  (no schema working copies found — nothing to check)");
  }

  for (const file of schemaSourceFiles) {
    const name = basename(file, ".ts");
    const workingPath = join(schemasDir, file);
    const canonicalPath = join(scaffoldSchemasDir, `tmpl_${name}.ts`);
    await checkPair(workingPath, canonicalPath, `schemas/${file}`);
  }
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === "ENOENT") {
    console.log("  (schemas/ directory not found — skipping)");
  } else {
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Check .agents/skills/ against scaffold/.agents/skills/
// ---------------------------------------------------------------------------
console.log("\nChecking .agents/skills/ against scaffold/.agents/skills/...");

const skillsDir = join(ROOT, ".agents", "skills");
const scaffoldSkillsDir = join(ROOT, "scaffold", ".agents", "skills");

try {
  const skillDirs = await readdir(skillsDir, { withFileTypes: true });
  const skillNames = skillDirs.filter((d) => d.isDirectory()).map((d) => d.name);

  if (skillNames.length === 0) {
    console.log("  (no skill working copies found — nothing to check)");
  }

  for (const skillName of skillNames) {
    const workingPath = join(skillsDir, skillName, "SKILL.md");
    const canonicalPath = join(scaffoldSkillsDir, skillName, "tmpl_SKILL.md");

    if (!(await fileExists(workingPath))) {
      console.error(`  MISSING working copy: ${workingPath}`);
      drifted++;
      continue;
    }

    await checkPair(workingPath, canonicalPath, `.agents/skills/${skillName}/SKILL.md`);
  }
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === "ENOENT") {
    console.log("  (.agents/skills/ directory not found — skipping)");
  } else {
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\nSync check complete: ${checked} pair(s) checked, ${drifted} drift(s) found.`);

if (drifted > 0) {
  console.error(
    "\nFAILED: One or more working copies have drifted from their scaffold originals.",
  );
  process.exitCode = 1;
} else {
  console.log("PASSED: All working copies are in sync with scaffold originals.");
}
