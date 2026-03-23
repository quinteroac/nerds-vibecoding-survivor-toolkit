import { access, mkdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
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

export interface InitDeps {
  /** Runs the interactive skills installer and returns its exit code. */
  skillsInstallerFn: (projectRoot: string, nvstSkillsPath: string) => Promise<number | null>;
}

/** Absolute path to the bundled `nvst-skills` directory shipped with this package. */
export const NVST_SKILLS_PATH: string = resolve(import.meta.dir, "../../nvst-skills");

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

  // Run skill installation before reporting success (US-003-AC02)
  const exitCode = await deps.skillsInstallerFn(projectRoot, NVST_SKILLS_PATH);
  if (exitCode !== 0) {
    // Installer failed or was aborted — do not report overall success (US-003-AC03)
    process.exitCode = exitCode ?? 1;
    return;
  }

  // Report success only after skills installation has finished successfully (US-003-AC02)
  console.log(
    `\nInit complete. Created ${created.length} file(s), skipped ${skipped.length} existing file(s).`,
  );
}
