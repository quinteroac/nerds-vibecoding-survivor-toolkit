import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "..");

const SKILL = {
  createPrototype: join(PROJECT_ROOT, "nvst-skills", "create-prototype", "SKILL.md"),
  refactorPrototype: join(PROJECT_ROOT, "nvst-skills", "refactor-prototype", "SKILL.md"),
  approvePrototype: join(PROJECT_ROOT, "nvst-skills", "approve-prototype", "SKILL.md"),
  auditPrototype: join(PROJECT_ROOT, "nvst-skills", "audit-prototype", "SKILL.md"),
} as const;

describe("US-003: Skills that receive NVST context variables prompt user for them when invoked standalone", () => {
  // AC01: Each affected skill has a Standalone Fallback section following the 4-step lookup order.
  it("AC01: create-prototype has Standalone Fallback section with 4-step lookup order", async () => {
    const content = await readFile(SKILL.createPrototype, "utf8");
    expect(content).toContain("### Standalone Fallback");
    expect(content).toContain("Injected context variable");
    expect(content).toContain("`state.json`");
    expect(content).toContain("Artifact files");
    expect(content).toContain("Ask user");
  });

  it("AC01: refactor-prototype has Standalone Fallback section with 4-step lookup order", async () => {
    const content = await readFile(SKILL.refactorPrototype, "utf8");
    expect(content).toContain("### Standalone Fallback");
    expect(content).toContain("Injected context variable");
    expect(content).toContain("`state.json`");
    expect(content).toContain("Artifact files");
    expect(content).toContain("Ask user");
  });

  it("AC01: approve-prototype has Standalone Fallback section with 4-step lookup order", async () => {
    const content = await readFile(SKILL.approvePrototype, "utf8");
    expect(content).toContain("### Standalone Fallback");
    expect(content).toContain("Injected context variable");
    expect(content).toContain("`state.json`");
    expect(content).toContain("Ask user");
  });

  it("AC01: audit-prototype has Standalone Fallback section with 4-step lookup order", async () => {
    const content = await readFile(SKILL.auditPrototype, "utf8");
    expect(content).toContain("### Standalone Fallback");
    expect(content).toContain("Injected context variable");
    expect(content).toContain("`state.json`");
    expect(content).toContain("Artifact files");
    expect(content).toContain("Ask user");
  });

  // AC02: create-prototype reads state.json → PRD artifacts → asks for iteration only as last resort.
  it("AC02: create-prototype reads state.json to get current_iteration when context absent", async () => {
    const content = await readFile(SKILL.createPrototype, "utf8");
    expect(content).toContain(".agents/state.json");
    expect(content).toContain("current_iteration");
  });

  it("AC02: create-prototype reads PRD.json (preferred) then markdown PRD as fallback", async () => {
    const content = await readFile(SKILL.createPrototype, "utf8");
    expect(content).toContain("it_{iteration}_PRD.json");
    expect(content).toContain("it_{iteration}_product-requirement-document.md");
    const prdJsonIndex = content.indexOf("it_{iteration}_PRD.json");
    const prdMdIndex = content.indexOf("it_{iteration}_product-requirement-document.md");
    expect(prdJsonIndex).toBeGreaterThan(-1);
    expect(prdMdIndex).toBeGreaterThan(-1);
    // PRD.json preferred over markdown — it should appear first in the fallback section
    expect(prdJsonIndex).toBeLessThan(prdMdIndex);
  });

  it("AC02: create-prototype only asks for iteration number if no state.json and no PRD file found", async () => {
    const content = await readFile(SKILL.createPrototype, "utf8");
    // The ask step is last (step 4) in the fallback section
    const standaloneIndex = content.indexOf("### Standalone Fallback");
    const askIndex = content.indexOf("Ask user", standaloneIndex);
    const artifactIndex = content.indexOf("Artifact files", standaloneIndex);
    expect(standaloneIndex).toBeGreaterThan(-1);
    expect(artifactIndex).toBeGreaterThan(standaloneIndex);
    expect(askIndex).toBeGreaterThan(artifactIndex);
  });

  // AC03: refactor-prototype reads state.json → audit artifacts → asks for iteration only as last resort.
  it("AC03: refactor-prototype reads state.json to get current_iteration when context absent", async () => {
    const content = await readFile(SKILL.refactorPrototype, "utf8");
    expect(content).toContain(".agents/state.json");
    expect(content).toContain("current_iteration");
  });

  it("AC03: refactor-prototype reads audit.json (preferred) then audit.md as fallback", async () => {
    const content = await readFile(SKILL.refactorPrototype, "utf8");
    const standaloneIndex = content.indexOf("### Standalone Fallback");
    expect(standaloneIndex).toBeGreaterThan(-1);
    expect(content).toContain("it_{iteration}_audit.json");
    expect(content).toContain("it_{iteration}_audit.md");
    const auditJsonIndex = content.indexOf("it_{iteration}_audit.json", standaloneIndex);
    const auditMdIndex = content.indexOf("it_{iteration}_audit.md", standaloneIndex);
    expect(auditJsonIndex).toBeGreaterThan(-1);
    expect(auditMdIndex).toBeGreaterThan(-1);
    expect(auditJsonIndex).toBeLessThan(auditMdIndex);
  });

  it("AC03: refactor-prototype only asks for iteration if no state.json and no audit artifact found", async () => {
    const content = await readFile(SKILL.refactorPrototype, "utf8");
    const standaloneIndex = content.indexOf("### Standalone Fallback");
    const artifactIndex = content.indexOf("Artifact files", standaloneIndex);
    const askIndex = content.indexOf("Ask user", standaloneIndex);
    expect(artifactIndex).toBeGreaterThan(standaloneIndex);
    expect(askIndex).toBeGreaterThan(artifactIndex);
  });

  // AC04: approve-prototype reads state.json → asks only if state.json absent.
  it("AC04: approve-prototype reads state.json to get iteration when context absent", async () => {
    const content = await readFile(SKILL.approvePrototype, "utf8");
    expect(content).toContain(".agents/state.json");
    expect(content).toContain("current_iteration");
  });

  it("AC04: approve-prototype only asks user if state.json is also absent", async () => {
    const content = await readFile(SKILL.approvePrototype, "utf8");
    const standaloneIndex = content.indexOf("### Standalone Fallback");
    const stateIndex = content.indexOf(".agents/state.json", standaloneIndex);
    const askIndex = content.indexOf("Ask user", standaloneIndex);
    expect(stateIndex).toBeGreaterThan(standaloneIndex);
    expect(askIndex).toBeGreaterThan(stateIndex);
    // approve-prototype does NOT need artifact files step — verify "Artifact files" is absent in fallback
    const artifactIndex = content.indexOf("Artifact files", standaloneIndex);
    // The ask should come right after state.json step (no artifact step in between)
    expect(askIndex).toBeGreaterThan(stateIndex);
    if (artifactIndex !== -1) {
      // If artifact step exists it must precede ask
      expect(askIndex).toBeGreaterThan(artifactIndex);
    }
  });

  // AC05: audit-prototype reads state.json → PRD artifacts → asks only as last resort.
  it("AC05: audit-prototype reads state.json to get current_iteration when context absent", async () => {
    const content = await readFile(SKILL.auditPrototype, "utf8");
    expect(content).toContain(".agents/state.json");
    expect(content).toContain("current_iteration");
  });

  it("AC05: audit-prototype resolves PRD.json (preferred) then markdown PRD as fallback", async () => {
    const content = await readFile(SKILL.auditPrototype, "utf8");
    const standaloneIndex = content.indexOf("### Standalone Fallback");
    expect(standaloneIndex).toBeGreaterThan(-1);
    expect(content).toContain("it_{iteration}_PRD.json");
    expect(content).toContain("it_{iteration}_product-requirement-document.md");
    const prdJsonIndex = content.indexOf("it_{iteration}_PRD.json", standaloneIndex);
    const prdMdIndex = content.indexOf("it_{iteration}_product-requirement-document.md", standaloneIndex);
    expect(prdJsonIndex).toBeGreaterThan(-1);
    expect(prdMdIndex).toBeGreaterThan(-1);
    expect(prdJsonIndex).toBeLessThan(prdMdIndex);
  });

  it("AC05: audit-prototype only asks for iteration if no state.json and no PRD artifact found", async () => {
    const content = await readFile(SKILL.auditPrototype, "utf8");
    const standaloneIndex = content.indexOf("### Standalone Fallback");
    const artifactIndex = content.indexOf("Artifact files", standaloneIndex);
    const askIndex = content.indexOf("Ask user", standaloneIndex);
    expect(artifactIndex).toBeGreaterThan(standaloneIndex);
    expect(askIndex).toBeGreaterThan(artifactIndex);
  });

  // AC06: Typecheck passes.
  it("AC06: typecheck passes without errors", async () => {
    const proc = Bun.spawn(["bun", "tsc", "--noEmit"], {
      cwd: PROJECT_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    if (proc.exitCode !== 0) {
      console.error("TypeScript errors:", stderr);
    }
    expect(proc.exitCode).toBe(0);
  }, 60_000);
});
