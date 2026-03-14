/**
 * Tests for US-004: `runIdeate` command handler.
 * Covers AC02, AC05, AC06, AC07.
 */
import { describe, it, expect } from "bun:test";
import { mkdtemp, mkdir, rm, readFile, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI_PATH = join(import.meta.dir, "..", "src", "cli.ts");

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCli(
  args: string[],
  cwd?: string,
  env?: Record<string, string>,
): Promise<CliResult> {
  const proc = Bun.spawn([process.argv[0], CLI_PATH, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: env ? { ...process.env, ...env } : undefined,
  });

  await proc.exited;

  return {
    exitCode: proc.exitCode,
    stdout: await new Response(proc.stdout).text(),
    stderr: await new Response(proc.stderr).text(),
  };
}

const MINIMAL_STATE = {
  current_iteration: "000001",
  current_phase: "define",
  phases: {
    define: {
      requirement_definition: { status: "pending", file: null },
      prd_generation: { status: "pending", file: null },
    },
    prototype: {},
    refactor: {},
  },
  last_updated: "2026-01-01T00:00:00.000Z",
  updated_by: "test",
};

async function createTempProject(stateData?: object): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), "nvst-ideate-handler-"));
  await mkdir(join(projectRoot, ".agents", "skills", "ideate"), { recursive: true });
  await writeFile(
    join(projectRoot, ".agents", "skills", "ideate", "SKILL.md"),
    "# Ideate skill\n\nConduct ideation.",
    "utf8",
  );
  if (stateData !== undefined) {
    await writeFile(
      join(projectRoot, ".agents", "state.json"),
      JSON.stringify(stateData, null, 2),
      "utf8",
    );
  }
  return projectRoot;
}

describe("runIdeate – US-004", () => {
  // AC02: reads ROADMAP.md and PROJECT_CONTEXT.md if they exist and passes them as context
  it("AC02: includes ROADMAP.md content in the prompt when the file exists", async () => {
    const projectRoot = await createTempProject();
    try {
      await writeFile(join(projectRoot, "ROADMAP.md"), "## Roadmap content", "utf8");

      // ide provider prints the prompt to stdout
      const result = await runCli(["ideate", "--agent", "ide"], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("ROADMAP.md");
      expect(result.stdout).toContain("Roadmap content");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("AC02: includes PROJECT_CONTEXT.md content in the prompt when the file exists", async () => {
    const projectRoot = await createTempProject();
    try {
      await writeFile(
        join(projectRoot, ".agents", "PROJECT_CONTEXT.md"),
        "## Project context content",
        "utf8",
      );

      const result = await runCli(["ideate", "--agent", "ide"], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("PROJECT_CONTEXT.md");
      expect(result.stdout).toContain("Project context content");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("AC02: runs without error when context files are absent", async () => {
    const projectRoot = await createTempProject();
    try {
      const result = await runCli(["ideate", "--agent", "ide"], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Ideation session started.");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // AC05: sets state.phases.define.ideation.status = "completed" after successful invocation
  it("AC05: sets ideation.status to 'completed' in state after success", async () => {
    const projectRoot = await createTempProject(MINIMAL_STATE);
    try {
      const result = await runCli(["ideate", "--agent", "ide"], projectRoot);

      expect(result.exitCode).toBe(0);

      const raw = await readFile(join(projectRoot, ".agents", "state.json"), "utf8");
      const state = JSON.parse(raw);

      expect(state.phases.define.ideation).toBeDefined();
      expect(state.phases.define.ideation.status).toBe("completed");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("AC05: refreshes last_updated when writing state after success", async () => {
    const projectRoot = await createTempProject(MINIMAL_STATE);
    try {
      await runCli(["ideate", "--agent", "ide"], projectRoot);

      const raw = await readFile(join(projectRoot, ".agents", "state.json"), "utf8");
      const state = JSON.parse(raw);

      expect(state.last_updated).not.toBe(MINIMAL_STATE.last_updated);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // AC06: throws Error when agent exits with non-zero code
  it("AC06: exits with code 1 and error message when agent fails", async () => {
    const projectRoot = await createTempProject();
    try {
      // Create a fake "claude" script that exits with code 1
      const binDir = join(projectRoot, "bin");
      await mkdir(binDir, { recursive: true });
      const fakeScript = join(binDir, "claude");
      await writeFile(fakeScript, "#!/bin/sh\nexit 1\n", "utf8");
      await chmod(fakeScript, 0o755);

      const result = await runCli(
        ["ideate", "--agent", "claude"],
        projectRoot,
        { PATH: `${binDir}:${process.env.PATH ?? ""}` },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("exit code 1");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // AC07: warns when current_phase is not "define"
  it("AC07: writes warning to stderr when current_phase is not 'define'", async () => {
    const projectRoot = await createTempProject({
      ...MINIMAL_STATE,
      current_phase: "prototype",
      phases: {
        ...MINIMAL_STATE.phases,
        prototype: {
          prototype_creation: { status: "in_progress", file: null },
        },
      },
    });
    try {
      const result = await runCli(["ideate", "--agent", "ide"], projectRoot);

      // Does not hard-block: exits 0
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("Warning:");
      expect(result.stderr).toContain("prototype");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("AC07: writes warning to stderr when ideation is already completed", async () => {
    const projectRoot = await createTempProject({
      ...MINIMAL_STATE,
      phases: {
        ...MINIMAL_STATE.phases,
        define: {
          ...MINIMAL_STATE.phases.define,
          ideation: { status: "completed", file: null },
        },
      },
    });
    try {
      const result = await runCli(["ideate", "--agent", "ide"], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("Warning:");
      expect(result.stderr).toContain("already completed");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("AC07: --force suppresses the guardrail warning", async () => {
    const projectRoot = await createTempProject({
      ...MINIMAL_STATE,
      current_phase: "prototype",
      phases: {
        ...MINIMAL_STATE.phases,
        prototype: {
          prototype_creation: { status: "in_progress", file: null },
        },
      },
    });
    try {
      const result = await runCli(["ideate", "--agent", "ide", "--force"], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
