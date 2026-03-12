import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runWriteJson } from "./write-json";

const ITERATION = "000025";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "nvst-write-json-audit-"));
}

describe("write-json command", () => {
  describe("US-005: Generate it_{iteration}_audit.json when user opts to refactor", () => {
    const validAuditData = {
      goals: ["Verify PRD compliance", "Produce refactor plan"],
      userStories: [
        {
          id: "US-001",
          title: "Audit",
          description: "Validate implementation.",
          acceptanceCriteria: [{ id: "US-001-AC01", text: "Audit runs." }],
        },
      ],
      functionalRequirements: [
        { id: "FR-1", description: "System shall support audit." },
      ],
      refactorPlan: "Refactor module X and Y.",
    };

    test("US-005-AC01: write-json generates it_{iteration}_audit.json using audit schema", async () => {
      const projectRoot = tempDir();
      const outPath = join(projectRoot, ".agents", "flow", `it_${ITERATION}_audit.json`);
      await runWriteJson({
        args: [
          "--schema",
          "audit",
          "--out",
          outPath,
          "--data",
          JSON.stringify(validAuditData),
        ],
      });
      const content = await readFile(outPath, "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed.goals).toEqual(validAuditData.goals);
      expect(parsed.userStories).toHaveLength(1);
      expect(parsed.functionalRequirements).toHaveLength(1);
      expect(parsed.refactorPlan).toBe(validAuditData.refactorPlan);
    });

    test("US-005-AC02: audit JSON structure is similar to PRD (goals, userStories, functionalRequirements) with refactor-oriented fields", async () => {
      const projectRoot = tempDir();
      const outPath = join(projectRoot, ".agents", "flow", `it_${ITERATION}_audit.json`);
      await runWriteJson({
        args: [
          "--schema",
          "audit",
          "--out",
          outPath,
          "--data",
          JSON.stringify(validAuditData),
        ],
      });
      const content = await readFile(outPath, "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed).toHaveProperty("goals");
      expect(Array.isArray(parsed.goals)).toBe(true);
      expect(parsed).toHaveProperty("userStories");
      expect(Array.isArray(parsed.userStories)).toBe(true);
      expect(parsed).toHaveProperty("functionalRequirements");
      expect(Array.isArray(parsed.functionalRequirements)).toBe(true);
      expect(parsed).toHaveProperty("refactorPlan");
    });

    test("US-005-AC03: file is written to .agents/flow/it_{iteration}_audit.json", async () => {
      const projectRoot = tempDir();
      const relativeOut = `.agents/flow/it_${ITERATION}_audit.json`;
      const absoluteOut = join(projectRoot, relativeOut);
      const origCwd = process.cwd();
      process.chdir(projectRoot);
      try {
        await runWriteJson({
          args: [
            "--schema",
            "audit",
            "--out",
            relativeOut,
            "--data",
            JSON.stringify(validAuditData),
          ],
        });
      } finally {
        process.chdir(origCwd);
      }
      const content = await readFile(absoluteOut, "utf-8");
      expect(content).toBeTruthy();
      const parsed = JSON.parse(content);
      expect(parsed.goals).toEqual(validAuditData.goals);
    });

    test("audit schema rejects invalid payload (missing goals)", async () => {
      const projectRoot = tempDir();
      const outPath = join(projectRoot, ".agents", "flow", `it_${ITERATION}_audit.json`);
      const invalidData = {
        userStories: [],
        functionalRequirements: [],
      };
      const prevExitCode = process.exitCode;
      process.exitCode = 0;
      await runWriteJson({
        args: [
          "--schema",
          "audit",
          "--out",
          outPath,
          "--data",
          JSON.stringify(invalidData),
        ],
      });
      expect(process.exitCode).toBe(1);
      process.exitCode = prevExitCode;
    });
  });
});
