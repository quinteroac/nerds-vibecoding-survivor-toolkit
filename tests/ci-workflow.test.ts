import { describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * US-003: GitHub Action - CI Pipeline
 * Tests verify acceptance criteria for the CI workflow.
 */
describe("US-003: CI workflow", () => {
  const workflowsDir = join(process.cwd(), ".github", "workflows");

  it("US-003-AC01: GitHub Action config file exists in .github/workflows", async () => {
    const entries = await readdir(workflowsDir, { withFileTypes: true });
    const workflowFiles = entries.filter((e) => e.isFile() && (e.name.endsWith(".yml") || e.name.endsWith(".yaml")));
    expect(workflowFiles.length).toBeGreaterThan(0);
  });

  it("US-003-AC02: Workflow triggers on push to main/master", async () => {
    const ciPath = join(workflowsDir, "ci.yml");
    const content = await readFile(ciPath, "utf8");
    expect(content).toMatch(/on:\s*\n\s*push:/);
    expect(content).toContain("branches:");
    expect(content).toMatch(/- main/);
    expect(content).toMatch(/- master/);
  });

  it("US-003-AC03: Workflow runs bun install, bun test, and build steps", async () => {
    const ciPath = join(workflowsDir, "ci.yml");
    const content = await readFile(ciPath, "utf8");
    expect(content).toMatch(/bun install/);
    expect(content).toMatch(/bun (run )?test/);
    expect(content).toMatch(/tsc --noEmit/);
  });

  it("US-003-AC04: Workflow reports success/failure correctly", async () => {
    const ciPath = join(workflowsDir, "ci.yml");
    const content = await readFile(ciPath, "utf8");
    expect(content).toMatch(/jobs:\s*\n\s+ci:/);
    expect(content).toContain("runs-on:");
    expect(content).toContain("steps:");
  });
});
