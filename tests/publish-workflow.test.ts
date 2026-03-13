import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";

const PUBLISH_WORKFLOW_PATH = ".github/workflows/publish.yml";

async function readPublishWorkflow(): Promise<string> {
  return readFile(PUBLISH_WORKFLOW_PATH, "utf8");
}

describe("publish workflow", () => {
  it("triggers when a GitHub release is published", async () => {
    const workflow = await readPublishWorkflow();

    expect(workflow).toContain("release:");
    expect(workflow).toContain("types: [published]");
  });

  it("builds macOS, Linux, and Windows binaries", async () => {
    const workflow = await readPublishWorkflow();

    expect(workflow).toContain("bun run build:binaries --outdir dist/release");
    expect(workflow).toContain("test -f dist/release/nvst-darwin-x64");
    expect(workflow).toContain("test -f dist/release/nvst-linux-x64");
    expect(workflow).toContain("test -f dist/release/nvst-windows-x64.exe");
  });

  it("uploads release binaries as GitHub release assets", async () => {
    const workflow = await readPublishWorkflow();

    expect(workflow).toContain("uses: softprops/action-gh-release@v2");
    expect(workflow).toContain("dist/release/nvst-darwin-x64");
    expect(workflow).toContain("dist/release/nvst-linux-x64");
    expect(workflow).toContain("dist/release/nvst-windows-x64.exe");
  });

  it("runs typecheck before publishing release binaries", async () => {
    const workflow = await readPublishWorkflow();

    expect(workflow).toContain("run: bun run typecheck");
  });
});
