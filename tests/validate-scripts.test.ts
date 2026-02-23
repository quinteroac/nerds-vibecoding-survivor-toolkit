import { describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const PROJECT_ROOT = join(import.meta.dir, "..");

type ScriptCase = {
  path: string;
  schemaFile: "tmpl_state.ts" | "tmpl_progress.ts";
  invalidJsonPath: string;
};

const SCRIPT_CASES: ScriptCase[] = [
  {
    path: "schemas/validate-state.ts",
    schemaFile: "tmpl_state.ts",
    invalidJsonPath: ".agents/tmpl_state.example.json",
  },
  {
    path: "schemas/validate-progress.ts",
    schemaFile: "tmpl_progress.ts",
    invalidJsonPath: ".agents/flow/tmpl_it_000001_progress.example.json",
  },
  {
    path: "scaffold/schemas/tmpl_validate-state.ts",
    schemaFile: "tmpl_state.ts",
    invalidJsonPath: ".agents/tmpl_state.example.json",
  },
  {
    path: "scaffold/schemas/tmpl_validate-progress.ts",
    schemaFile: "tmpl_progress.ts",
    invalidJsonPath: ".agents/flow/tmpl_it_000001_progress.example.json",
  },
];

describe("validation scripts", () => {
  it("use asynchronous file I/O", async () => {
    for (const scriptCase of SCRIPT_CASES) {
      const source = await readFile(scriptCase.path, "utf-8");

      expect(source.includes("readFileSync")).toBe(false);
      expect(source.includes("Bun.file(") || source.includes("from \"node:fs/promises\"")).toBe(
        true,
      );
    }
  });

  it("do not call process.exit() and use process.exitCode on failure", async () => {
    for (const scriptCase of SCRIPT_CASES) {
      const source = await readFile(scriptCase.path, "utf-8");
      expect(source.includes("process.exit(")).toBe(false);
      expect(source.includes("process.exitCode = 1")).toBe(true);
    }
  });

  it("return exit code 1 and report validation errors when validation fails", async () => {
    const sandboxRoot = await mkdtemp(join(tmpdir(), "nvst-us-002-"));

    try {
      for (const [index, scriptCase] of SCRIPT_CASES.entries()) {
        const caseRoot = join(sandboxRoot, `case-${index}`);
        const schemasDir = join(caseRoot, "schemas");

        await mkdir(schemasDir, { recursive: true });

        const scriptSource = await readFile(scriptCase.path, "utf-8");
        const scriptFileName = scriptCase.path.split("/").pop();
        if (!scriptFileName) {
          throw new Error(`Could not determine script filename for ${scriptCase.path}`);
        }

        const scriptDest = join(schemasDir, scriptFileName);
        await writeFile(scriptDest, scriptSource);

        const schemaSource = await readFile(
          join("scaffold", "schemas", scriptCase.schemaFile),
          "utf-8",
        );
        await writeFile(join(schemasDir, scriptCase.schemaFile), schemaSource);

        const invalidJsonDest = join(caseRoot, scriptCase.invalidJsonPath);
        await mkdir(join(invalidJsonDest, ".."), { recursive: true });
        await writeFile(invalidJsonDest, "{}\n");

        const projectNodeModules = join(PROJECT_ROOT, "node_modules");
        await symlink(projectNodeModules, join(caseRoot, "node_modules"));

        const proc = Bun.spawn(["bun", "run", scriptDest], {
          cwd: caseRoot,
          stderr: "pipe",
          stdout: "pipe",
        });

        const stderrPromise = proc.stderr ? new Response(proc.stderr).text() : Promise.resolve("");
        const [exitCode, stderr] = await Promise.all([proc.exited, stderrPromise]);
        expect(exitCode).toBe(1);
        expect(stderr).toMatch(/validation failed/i);
      }
    } finally {
      await rm(sandboxRoot, { recursive: true, force: true });
    }
  });
});
