import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { NVST_SKILLS_FILES } from "../nvst-skills-manifest";
import { SCAFFOLD_FILES } from "../scaffold-manifest";

const TEMPLATE_PREFIX = "tmpl_";

export interface ScaffoldEntry {
  content: string;
  destinationPath: string;
  relativeDestinationPath: string;
}

function stripTemplatePrefix(fileName: string): string {
  return fileName.startsWith(TEMPLATE_PREFIX) ? fileName.slice(TEMPLATE_PREFIX.length) : fileName;
}

export function getScaffoldEntries(projectRoot: string): ScaffoldEntry[] {
  return SCAFFOLD_FILES.filter(({ relativePath }) => !relativePath.startsWith("schemas/")).map(
    ({ relativePath, content }) => {
      const sourceDir = dirname(relativePath);
      const targetFileName = stripTemplatePrefix(basename(relativePath));
      const relativeDestinationPath =
        sourceDir === "." ? targetFileName : join(sourceDir, targetFileName);

      return {
        content,
        destinationPath: join(projectRoot, relativeDestinationPath),
        relativeDestinationPath,
      };
    },
  );
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Writes the embedded nvst-skills manifest to a temporary directory and returns
 * its path. The caller is responsible for deleting the directory when done.
 */
export async function writeNvstSkillsToTemp(): Promise<string> {
  const tempDir = join(tmpdir(), `nvst-skills-${Date.now()}`);
  for (const { relativePath, content } of NVST_SKILLS_FILES) {
    const dest = join(tempDir, relativePath);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, content, "utf8");
  }
  return tempDir;
}

export interface InitDeps {
  /** Runs the interactive skills installer and returns its exit code. */
  skillsInstallerFn: (projectRoot: string, nvstSkillsPath: string) => Promise<number | null>;
}

export const defaultInitDeps: InitDeps = {
  skillsInstallerFn: async (projectRoot: string, nvstSkillsPath: string): Promise<number | null> => {
    if (!process.stdin.isTTY) {
      return 0;
    }
    const proc = Bun.spawn(["npx", "skills", "add", nvstSkillsPath], {
      cwd: projectRoot,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    return proc.exited;
  },
};

export async function runInit(deps: InitDeps = defaultInitDeps): Promise<void> {
  const projectRoot = process.cwd();
  const entries = getScaffoldEntries(projectRoot);

  const created: string[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    if (await exists(entry.destinationPath)) {
      console.warn(`Skipping existing file: ${entry.relativeDestinationPath}`);
      skipped.push(entry.relativeDestinationPath);
      continue;
    }

    await mkdir(dirname(entry.destinationPath), { recursive: true });
    await Bun.write(entry.destinationPath, entry.content);
    created.push(entry.relativeDestinationPath);
    console.log(`Created: ${entry.relativeDestinationPath}`);
  }

  // Materialize bundled nvst-skills to a temp directory so the path always
  // exists regardless of whether nvst is running from source or as a binary.
  const tempSkillsDir = await writeNvstSkillsToTemp();

  try {
    // Run skill installation before reporting success (US-003-AC02)
    const exitCode = await deps.skillsInstallerFn(projectRoot, tempSkillsDir);
    if (exitCode !== 0) {
      // Installer failed or was aborted — do not report overall success (US-003-AC03)
      process.exitCode = exitCode ?? 1;
      return;
    }
  } finally {
    await rm(tempSkillsDir, { recursive: true, force: true });
  }

  // Report success only after skills installation has finished successfully (US-003-AC02)
  console.log(
    `\nInit complete. Created ${created.length} file(s), skipped ${skipped.length} existing file(s).`,
  );
}
