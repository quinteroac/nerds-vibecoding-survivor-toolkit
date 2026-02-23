import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * US-004: GitHub Action - Manual Release Trigger
 * Tests verify acceptance criteria for the manual release workflow.
 */
describe("US-004: Release workflow", () => {
  const workflowsDir = join(process.cwd(), ".github", "workflows");
  const releasePath = join(workflowsDir, "release.yml");

  it("US-004-AC01: Workflow uses workflow_dispatch trigger", async () => {
    const content = await readFile(releasePath, "utf8");
    expect(content).toMatch(/on:\s*\n\s*workflow_dispatch:/);
  });

  it("US-004-AC02: Triggering the workflow builds the package", async () => {
    const content = await readFile(releasePath, "utf8");
    expect(content).toContain("Build package");
    expect(content).toMatch(/bun run package|npm pack/);
  });

  it("US-004-AC03: The built package is uploaded as an artifact or published to GitHub Packages", async () => {
    const content = await readFile(releasePath, "utf8");
    const hasArtifactUpload =
      content.includes("upload-artifact") || content.includes("upload_artifact");
    const hasGitHubPackages =
      content.includes("publish") && content.includes("GITHUB_TOKEN");
    expect(hasArtifactUpload || hasGitHubPackages).toBe(true);
  });
});
