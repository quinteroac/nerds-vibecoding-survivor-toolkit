import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  appendTechnicalDebtItems,
  DEFAULT_TECHNICAL_DEBT_PATH,
} from "./technical-debt";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "nvst-technical-debt-"));
}

describe("technical-debt module", () => {
  test("US-006-AC01: appends debt items to TECHNICAL_DEBT.md when file exists", async () => {
    const projectRoot = tempDir();
    const path = join(projectRoot, DEFAULT_TECHNICAL_DEBT_PATH);
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      path,
      "# Technical Debt\n\n## Existing\n\nSome old content.\n",
      "utf-8",
    );

    await appendTechnicalDebtItems(projectRoot, {
      items: [
        { title: "New debt item", description: "Description of the debt." },
      ],
      iteration: "000025",
    });

    const content = await readFile(path, "utf-8");
    expect(content).toContain("# Technical Debt");
    expect(content).toContain("## Existing");
    expect(content).toContain("Some old content.");
    expect(content).toContain("## From iteration 000025");
    expect(content).toContain("### New debt item");
    expect(content).toContain("Description of the debt.");
  });

  test("US-006-AC01: creates TECHNICAL_DEBT.md with default header when file does not exist", async () => {
    const projectRoot = tempDir();

    await appendTechnicalDebtItems(projectRoot, {
      items: [{ title: "First debt", description: "First description." }],
      iteration: "000001",
    });

    const path = join(projectRoot, DEFAULT_TECHNICAL_DEBT_PATH);
    const content = await readFile(path, "utf-8");
    expect(content).toContain("# Technical Debt");
    expect(content).toContain("## From iteration 000001");
    expect(content).toContain("### First debt");
    expect(content).toContain("First description.");
  });

  test("US-006-AC02: updates are additive — existing debt entries are not lost", async () => {
    const projectRoot = tempDir();
    const path = join(projectRoot, DEFAULT_TECHNICAL_DEBT_PATH);
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(path), { recursive: true });
    const initial =
      "# Technical Debt\n\n## From iteration 000020\n\n### Old item\n\nOld body.\n\n---\n\n";
    await writeFile(path, initial, "utf-8");

    await appendTechnicalDebtItems(projectRoot, {
      items: [
        { title: "New item A", description: "Desc A" },
        { title: "New item B", description: "Desc B" },
      ],
      iteration: "000025",
    });

    const content = await readFile(path, "utf-8");
    expect(content).toContain("## From iteration 000020");
    expect(content).toContain("### Old item");
    expect(content).toContain("Old body.");
    expect(content).toContain("## From iteration 000025");
    expect(content).toContain("### New item A");
    expect(content).toContain("Desc A");
    expect(content).toContain("### New item B");
    expect(content).toContain("Desc B");
  });

  test("uses custom file path when filePath option is provided", async () => {
    const projectRoot = tempDir();
    const customPath = "docs/TECHNICAL_DEBT.md";

    await appendTechnicalDebtItems(projectRoot, {
      items: [{ title: "Custom path item", description: "In custom file." }],
      iteration: "000030",
      filePath: customPath,
    });

    const content = await readFile(join(projectRoot, customPath), "utf-8");
    expect(content).toContain("### Custom path item");
    expect(content).toContain("In custom file.");
    expect(content).toContain("## From iteration 000030");
  });

  test("does nothing when items array is empty", async () => {
    const projectRoot = tempDir();
    const path = join(projectRoot, DEFAULT_TECHNICAL_DEBT_PATH);
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(path), { recursive: true });
    const initial = "# Technical Debt\n\nExisting.\n";
    await writeFile(path, initial, "utf-8");

    await appendTechnicalDebtItems(projectRoot, { items: [] });

    const content = await readFile(path, "utf-8");
    expect(content).toBe(initial);
  });
});
