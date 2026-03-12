import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const LOOP_TEXT =
  "Define/Refine/Approve Requirement → Create Prototype → Audit Prototype → Refactor Prototype → Approve Prototype";

const DOC_PATHS = [
  "AGENTS.md",
  "README.md",
  "process_design.md",
  "docs/nvst-flow/COMMANDS.md",
  "docs/nvst-flow/QUICK_USE.md",
  "scaffold/tmpl_AGENTS.md",
  "scaffold/docs/nvst-flow/tmpl_COMMANDS.md",
  "scaffold/docs/nvst-flow/tmpl_QUICK_USE.md",
] as const;

const REMOVED_COMMANDS = [
  "bun nvst create project-context",
  "bun nvst approve project-context",
  "bun nvst define test-plan",
  "bun nvst refine test-plan",
  "bun nvst approve test-plan",
  "bun nvst execute test-plan",
  "bun nvst execute automated-fix",
  "bun nvst execute manual-fix",
  "bun nvst define refactor-plan",
  "bun nvst refine refactor-plan",
  "bun nvst approve refactor-plan",
  "bun nvst execute refactor",
  "bun nvst create prd",
  "bun nvst start iteration",
] as const;

async function readDoc(path: string): Promise<string> {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("US-005: Documentation describes the new main loop", () => {
  it("US-005-AC01: Core workflow docs describe the updated main loop", async () => {
    for (const path of DOC_PATHS) {
      const content = await readDoc(path);
      expect(content).toContain(LOOP_TEXT);
    }
  });

  it("US-005-AC02: Example flows no longer reference removed workflow commands", async () => {
    for (const path of DOC_PATHS) {
      const content = await readDoc(path);
      for (const command of REMOVED_COMMANDS) {
        expect(content).not.toContain(command);
      }
    }
  });

  it("US-005-AC03: At least one end-to-end example lists commands in the expected order", async () => {
    const content = await readDoc("docs/nvst-flow/QUICK_USE.md");
    const orderedCommands = [
      "bun nvst define requirement",
      "bun nvst refine requirement",
      "bun nvst approve requirement",
      "bun nvst create prototype",
      "bun nvst audit prototype",
      "bun nvst refactor prototype",
      "bun nvst approve prototype",
    ];

    let lastIndex = -1;
    for (const command of orderedCommands) {
      const index = content.indexOf(command);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it("US-005-AC04: Updated workflow docs remain in English", async () => {
    for (const path of DOC_PATHS) {
      const content = await readDoc(path);
      expect(content).not.toMatch(/\b(proceso|iteracion|iteración|flujo|requisito|prototipo)\b/i);
    }
  });
});
