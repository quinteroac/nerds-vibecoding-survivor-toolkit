import { describe, expect, it } from "bun:test";
import { access, readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

type DistSnapshot = {
  exists: boolean;
  files: Array<{ path: string; mtimeMs: number; size: number }>;
};

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function snapshotDist(distRoot: string): Promise<DistSnapshot> {
  if (!(await pathExists(distRoot))) {
    return { exists: false, files: [] };
  }

  const files: Array<{ path: string; mtimeMs: number; size: number }> = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      const metadata = await stat(absolutePath);
      files.push({
        path: absolutePath.slice(distRoot.length + 1),
        mtimeMs: metadata.mtimeMs,
        size: metadata.size,
      });
    }
  }

  await walk(distRoot);
  files.sort((a, b) => a.path.localeCompare(b.path));

  return { exists: true, files };
}

describe("project-wide type checking", () => {
  it("includes src/**/*.ts in tsconfig.json include list", async () => {
    const tsconfigRaw = await readFile("tsconfig.json", "utf8");
    const tsconfig = JSON.parse(tsconfigRaw) as { include?: string[] };

    expect(tsconfig.include).toBeArray();
    expect(tsconfig.include).toContain("src/**/*.ts");
  });

  it("TC-007: runs bun tsc --noEmit successfully without emitting build artifacts", async () => {
    const cwd = process.cwd();
    const distPath = join(cwd, "dist");
    const before = await snapshotDist(distPath);

    const proc = Bun.spawn(["bun", "tsc", "--noEmit"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    const after = await snapshotDist(distPath);

    expect(exitCode, stderr).toBe(0);
    expect(after).toEqual(before);
  });
});
