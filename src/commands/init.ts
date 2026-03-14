import { access, mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
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

export async function runInit(): Promise<void> {
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

  console.log(
    `\nInit complete. Created ${created.length} file(s), skipped ${skipped.length} existing file(s).`,
  );
}
