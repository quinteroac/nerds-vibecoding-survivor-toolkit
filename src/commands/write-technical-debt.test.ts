import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runWriteTechnicalDebt } from "./write-technical-debt";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "nvst-write-technical-debt-"));
}

describe("write-technical-debt command", () => {
  test("US-006-AC01: command updates .agents/TECHNICAL_DEBT.md with marked debt items", async () => {
    const projectRoot = tempDir();
    const prevCwd = process.cwd();
    process.chdir(projectRoot);

    try {
      const payload = {
        iteration: "000025",
        items: [
          {
            title: "Recommendation left as debt",
            description: "User chose option c for this item.",
          },
        ],
      };
      await runWriteTechnicalDebt({
        args: ["--data", JSON.stringify(payload)],
      });

      const path = join(projectRoot, ".agents", "TECHNICAL_DEBT.md");
      const content = await readFile(path, "utf-8");
      expect(content).toContain("# Technical Debt");
      expect(content).toContain("## From iteration 000025");
      expect(content).toContain("### Recommendation left as debt");
      expect(content).toContain("User chose option c for this item.");
    } finally {
      process.chdir(prevCwd);
    }
  });

  test("US-006-AC02: multiple runs merge correctly — existing entries are not lost", async () => {
    const projectRoot = tempDir();
    const prevCwd = process.cwd();
    process.chdir(projectRoot);

    try {
      await runWriteTechnicalDebt({
        args: [
          "--data",
          JSON.stringify({
            iteration: "000024",
            items: [{ title: "First run item", description: "From first run." }],
          }),
        ],
      });

      await runWriteTechnicalDebt({
        args: [
          "--data",
          JSON.stringify({
            iteration: "000025",
            items: [
              { title: "Second run item", description: "From second run." },
            ],
          }),
        ],
      });

      const path = join(projectRoot, ".agents", "TECHNICAL_DEBT.md");
      const content = await readFile(path, "utf-8");
      expect(content).toContain("## From iteration 000024");
      expect(content).toContain("### First run item");
      expect(content).toContain("From first run.");
      expect(content).toContain("## From iteration 000025");
      expect(content).toContain("### Second run item");
      expect(content).toContain("From second run.");
    } finally {
      process.chdir(prevCwd);
    }
  });

  test("US-006-AC01: respects --out for project-designated technical-debt file", async () => {
    const projectRoot = tempDir();
    const prevCwd = process.cwd();
    process.chdir(projectRoot);

    try {
      await runWriteTechnicalDebt({
        args: [
          "--out",
          "docs/MY_DEBT.md",
          "--data",
          JSON.stringify({
            iteration: "000025",
            items: [{ title: "Custom location item", description: "Stored elsewhere." }],
          }),
        ],
      });

      const content = await readFile(
        join(projectRoot, "docs", "MY_DEBT.md"),
        "utf-8",
      );
      expect(content).toContain("### Custom location item");
      expect(content).toContain("Stored elsewhere.");
    } finally {
      process.chdir(prevCwd);
    }
  });

  test("throws when payload has no items", async () => {
    const projectRoot = tempDir();
    const prevCwd = process.cwd();
    process.chdir(projectRoot);

    try {
      await expect(
        runWriteTechnicalDebt({
          args: ["--data", JSON.stringify({ iteration: "000025", items: [] })],
        }),
      ).rejects.toThrow(/Invalid payload|items/);
    } finally {
      process.chdir(prevCwd);
    }
  });

  test("throws when JSON is invalid", async () => {
    const projectRoot = tempDir();
    const prevCwd = process.cwd();
    process.chdir(projectRoot);

    try {
      await expect(
        runWriteTechnicalDebt({
          args: ["--data", "not json"],
        }),
      ).rejects.toThrow(/Invalid JSON|Invalid payload/);
    } finally {
      process.chdir(prevCwd);
    }
  });
});
