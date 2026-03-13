import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Default path for the technical-debt file relative to project root. */
export const DEFAULT_TECHNICAL_DEBT_PATH = ".agents/TECHNICAL_DEBT.md";

/** Single debt item to append (e.g. from audit "leave as debt"). */
export interface DebtItem {
  /** Short title for the debt entry. */
  title: string;
  /** Optional longer description. */
  description?: string;
}

/** Options for appending debt items. */
export interface AppendTechnicalDebtOptions {
  /** One or more debt items to add. */
  items: DebtItem[];
  /** Optional iteration label (e.g. "000025") for the new section heading. */
  iteration?: string;
  /** Optional path relative to projectRoot; defaults to DEFAULT_TECHNICAL_DEBT_PATH. */
  filePath?: string;
}

const DEFAULT_HEADER = `# Technical Debt

<!-- All content in English. Updated when approving refactor plan or after resolving known debt items.
     Used as input in future iteration evaluations so that evaluation and refactor cycles have a
     single place to look. -->

`;

/**
 * Appends debt items to the project's technical-debt file. Existing content is preserved
 * (additive merge). If the file does not exist, it is created with a default header.
 */
export async function appendTechnicalDebtItems(
  projectRoot: string,
  options: AppendTechnicalDebtOptions,
): Promise<void> {
  const { items, iteration, filePath } = options;
  if (items.length === 0) {
    return;
  }

  const relativePath = filePath ?? DEFAULT_TECHNICAL_DEBT_PATH;
  const absolutePath = join(projectRoot, relativePath);

  let existingContent: string;
  try {
    existingContent = await readFile(absolutePath, "utf-8");
  } catch {
    existingContent = DEFAULT_HEADER;
  }

  const sectionHeading = iteration
    ? `## From iteration ${iteration}`
    : "## New debt items";
  const sectionLines: string[] = [sectionHeading, ""];

  for (const item of items) {
    const safeTitle = item.title.trim() || "Untitled debt item";
    sectionLines.push(`### ${safeTitle}`);
    sectionLines.push("");
    if (item.description?.trim()) {
      sectionLines.push(item.description.trim());
      sectionLines.push("");
    }
    sectionLines.push("---");
    sectionLines.push("");
  }

  const newSection = sectionLines.join("\n");
  const mergedContent = existingContent.trimEnd() + "\n\n" + newSection;

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, mergedContent, "utf-8");
}
