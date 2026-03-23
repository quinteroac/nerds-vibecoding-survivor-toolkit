import { describe, it, expect } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI_PATH = join(import.meta.dir, "..", "src", "cli.ts");

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCli(args: string[], cwd?: string): Promise<CliResult> {
  const proc = Bun.spawn([process.argv[0], CLI_PATH, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  await proc.exited;

  return {
    exitCode: proc.exitCode,
    stdout: await new Response(proc.stdout).text(),
    stderr: await new Response(proc.stderr).text(),
  };
}

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-us003-"));
}

function makeDefineState(): unknown {
  return {
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
    history: [],
  };
}

function makeValidPrd(): unknown {
  return {
    goals: ["Build a working prototype"],
    userStories: [
      {
        id: "US-001",
        title: "Basic feature",
        description: "As a user I want to do something useful.",
        acceptanceCriteria: [{ id: "US-001-AC01", text: "It works." }],
      },
    ],
    functionalRequirements: [{ id: "FR-1", description: "Must work" }],
  };
}

async function writeState(projectRoot: string, state: unknown): Promise<void> {
  await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });
  await writeFile(
    join(projectRoot, ".agents", "state.json"),
    JSON.stringify(state, null, 2),
    "utf8",
  );
}

async function writeSkill(projectRoot: string, skillName: string): Promise<void> {
  await mkdir(join(projectRoot, ".agents", "skills", skillName), { recursive: true });
  await writeFile(
    join(projectRoot, ".agents", "skills", skillName, "SKILL.md"),
    `# ${skillName} skill\n\nThis is the ${skillName} skill content.`,
    "utf8",
  );
}

async function initGitRepo(projectRoot: string): Promise<void> {
  const git = (args: string[]) =>
    Bun.spawn(["git", ...args], { cwd: projectRoot, stdout: "ignore", stderr: "ignore" });

  await git(["init"]).exited;
  await git(["config", "user.email", "test@nvst.test"]).exited;
  await git(["config", "user.name", "NVST Test"]).exited;
  await writeFile(join(projectRoot, ".gitkeep"), "");
  await git(["add", "."]).exited;
  await git(["commit", "-m", "initial commit"]).exited;
}

describe("US-003: All existing commands work identically after migration", () => {
  // US-003-AC01: `bun nvst init` runs without error in a fresh directory
  it("US-003-AC01: nvst init runs without error in a fresh directory", async () => {
    const projectRoot = await createTempDir();
    try {
      const result = await runCli(["init"], projectRoot);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // US-003-AC02: `bun nvst destroy` and `bun nvst destroy --clean` run without error
  it("US-003-AC02a: nvst destroy runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      const result = await runCli(["destroy"], projectRoot);
      // In non-TTY context, confirmDeletion returns false → "Destroy canceled." or "Nothing to remove."
      expect(result.exitCode).toBe(0);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("US-003-AC02b: nvst destroy --clean runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      const result = await runCli(["destroy", "--clean"], projectRoot);
      expect(result.exitCode).toBe(0);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // US-003-AC03: `bun nvst start iteration` runs without error
  it("US-003-AC03: nvst start iteration runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });
      const result = await runCli(["start", "iteration"], projectRoot);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Iteration 000001 started");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // US-003-AC04: `bun nvst ideate --agent ide` runs without error
  it("US-003-AC04: nvst ideate --agent ide runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      await writeState(projectRoot, makeDefineState());
      await writeSkill(projectRoot, "ideate");
      const result = await runCli(["ideate", "--agent", "ide"], projectRoot);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // US-003-AC05: `bun nvst define requirement --agent ide` runs without error
  it("US-003-AC05: nvst define requirement --agent ide runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      await writeState(projectRoot, makeDefineState());
      await writeSkill(projectRoot, "create-pr-document");
      const result = await runCli(["define", "requirement", "--agent", "ide"], projectRoot);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // US-003-AC06: `bun nvst refine requirement --agent ide --challenge --force` runs without error
  it("US-003-AC06: nvst refine requirement --agent ide --challenge --force runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      const requirementFile = "it_000001_product-requirement-document.md";
      const state = {
        current_iteration: "000001",
        current_phase: "define",
        phases: {
          define: {
            requirement_definition: { status: "in_progress", file: requirementFile },
            prd_generation: { status: "pending", file: null },
          },
          prototype: {},
          refactor: {},
        },
        last_updated: "2026-01-01T00:00:00.000Z",
        history: [],
      };
      await writeState(projectRoot, state);
      await writeSkill(projectRoot, "refine-pr-document");
      await writeFile(
        join(projectRoot, ".agents", "flow", requirementFile),
        "# Product Requirement Document\n\nSome requirement content.",
        "utf8",
      );

      const result = await runCli(
        ["refine", "requirement", "--agent", "ide", "--challenge", "--force"],
        projectRoot,
      );
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // US-003-AC07: `bun nvst refine project-context --agent ide` runs without error
  it("US-003-AC07: nvst refine project-context --agent ide runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      const state = {
        current_iteration: "000001",
        current_phase: "prototype",
        phases: {
          define: {
            requirement_definition: { status: "approved", file: "it_000001_product-requirement-document.md" },
            prd_generation: { status: "completed", file: "it_000001_PRD.json" },
          },
          prototype: {
            project_context: { status: "created", file: ".agents/PROJECT_CONTEXT.md" },
          },
          refactor: {},
        },
        last_updated: "2026-01-01T00:00:00.000Z",
        history: [],
      };
      await writeState(projectRoot, state);
      await writeSkill(projectRoot, "refine-project-context");
      await writeFile(
        join(projectRoot, ".agents", "PROJECT_CONTEXT.md"),
        "# Project Context\n\nSome context.",
        "utf8",
      );

      const result = await runCli(["refine", "project-context", "--agent", "ide"], projectRoot);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // US-003-AC08: approve requirement, approve prototype, approve project-context
  it("US-003-AC08a: nvst approve requirement runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      const requirementFile = "it_000001_product-requirement-document.md";
      const state = {
        current_iteration: "000001",
        current_phase: "define",
        phases: {
          define: {
            requirement_definition: { status: "in_progress", file: requirementFile },
            prd_generation: { status: "pending", file: null },
          },
          prototype: {},
          refactor: {},
        },
        last_updated: "2026-01-01T00:00:00.000Z",
        history: [],
      };
      await writeState(projectRoot, state);
      await writeFile(
        join(projectRoot, ".agents", "flow", requirementFile),
        "# Product Requirement Document\n\n## Goals\n\n- Build something\n\n## User Stories\n\n## Functional Requirements\n",
        "utf8",
      );

      const result = await runCli(["approve", "requirement"], projectRoot);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Requirement approved.");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("US-003-AC08b: nvst approve prototype runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      const state = {
        current_iteration: "000001",
        current_phase: "prototype",
        phases: {
          define: {
            requirement_definition: { status: "approved", file: "it_000001_product-requirement-document.md" },
            prd_generation: { status: "completed", file: "it_000001_PRD.json" },
          },
          prototype: {
            prototype_creation: { status: "in_progress", file: "it_000001_progress.json" },
            prototype_audit: { status: "in_progress", file: null },
          },
          refactor: {},
        },
        last_updated: "2026-01-01T00:00:00.000Z",
        history: [],
      };
      await writeState(projectRoot, state);
      await writeSkill(projectRoot, "approve-prototype");
      // Provide audit.md (not audit.json) so guardrail is satisfied without requiring refactor
      await writeFile(
        join(projectRoot, ".agents", "flow", "it_000001_audit.md"),
        "# Audit Report\n\nAll checks passed.",
        "utf8",
      );

      const result = await runCli(["approve", "prototype"], projectRoot);
      expect(result.exitCode).toBe(0);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("US-003-AC08c: nvst approve project-context runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      const state = {
        current_iteration: "000001",
        current_phase: "prototype",
        phases: {
          define: {
            requirement_definition: { status: "approved", file: "it_000001_product-requirement-document.md" },
            prd_generation: { status: "completed", file: "it_000001_PRD.json" },
          },
          prototype: {
            project_context: { status: "pending_approval", file: ".agents/PROJECT_CONTEXT.md" },
          },
          refactor: {},
        },
        last_updated: "2026-01-01T00:00:00.000Z",
        history: [],
      };
      await writeState(projectRoot, state);
      await writeFile(
        join(projectRoot, ".agents", "PROJECT_CONTEXT.md"),
        "# Project Context\n\nSome context.",
        "utf8",
      );

      const result = await runCli(["approve", "project-context"], projectRoot);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Project context approved.");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // US-003-AC09: create prototype with all options
  it("US-003-AC09: nvst create prototype --agent ide --iterations 2 --retry-on-fail 1 --stop-on-critical runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      const state = {
        current_iteration: "000001",
        current_phase: "prototype",
        phases: {
          define: {
            requirement_definition: { status: "approved", file: "it_000001_product-requirement-document.md" },
            prd_generation: { status: "completed", file: "it_000001_PRD.json" },
          },
          prototype: {
            prototype_creation: { status: "pending", file: null },
          },
          refactor: {},
        },
        last_updated: "2026-01-01T00:00:00.000Z",
        history: [],
      };
      await writeState(projectRoot, state);
      await writeSkill(projectRoot, "implement-user-story");

      await writeFile(
        join(projectRoot, ".agents", "flow", "it_000001_PRD.json"),
        JSON.stringify(makeValidPrd(), null, 2),
        "utf8",
      );
      await writeFile(
        join(projectRoot, ".agents", "PROJECT_CONTEXT.md"),
        "# Project Context\n\nMinimal context for test.",
        "utf8",
      );

      // create-prototype requires a git repository for working tree checks
      await initGitRepo(projectRoot);

      const result = await runCli(
        [
          "create",
          "prototype",
          "--agent",
          "ide",
          "--iterations",
          "2",
          "--retry-on-fail",
          "1",
          "--stop-on-critical",
        ],
        projectRoot,
      );
      expect(result.exitCode).toBe(0);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // US-003-AC10: create project-context --mode yolo
  it("US-003-AC10: nvst create project-context --agent ide --mode yolo runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      const prdFile = "it_000001_PRD.json";
      const state = {
        current_iteration: "000001",
        current_phase: "define",
        phases: {
          define: {
            requirement_definition: { status: "approved", file: "it_000001_product-requirement-document.md" },
            prd_generation: { status: "completed", file: prdFile },
          },
          prototype: {
            project_context: { status: "pending", file: null },
          },
          refactor: {},
        },
        last_updated: "2026-01-01T00:00:00.000Z",
        history: [],
      };
      await writeState(projectRoot, state);
      await writeSkill(projectRoot, "create-project-context");
      await writeFile(
        join(projectRoot, ".agents", "flow", prdFile),
        JSON.stringify(makeValidPrd(), null, 2),
        "utf8",
      );

      const result = await runCli(
        ["create", "project-context", "--agent", "ide", "--mode", "yolo"],
        projectRoot,
      );
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // US-003-AC11: audit prototype
  it("US-003-AC11: nvst audit prototype --agent ide runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      const state = {
        current_iteration: "000001",
        current_phase: "prototype",
        phases: {
          define: {
            requirement_definition: { status: "approved", file: null },
            prd_generation: { status: "completed", file: null },
          },
          prototype: {
            prototype_creation: { status: "in_progress", file: "it_000001_progress.json" },
          },
          refactor: {},
        },
        last_updated: "2026-01-01T00:00:00.000Z",
        history: [],
      };
      await writeState(projectRoot, state);
      await writeSkill(projectRoot, "audit-prototype");

      const result = await runCli(["audit", "prototype", "--agent", "ide"], projectRoot);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // US-003-AC12: refactor prototype
  it("US-003-AC12: nvst refactor prototype --agent ide runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      const auditFile = "it_000001_audit.json";
      const state = {
        current_iteration: "000001",
        current_phase: "prototype",
        phases: {
          define: {
            requirement_definition: { status: "approved", file: null },
            prd_generation: { status: "completed", file: null },
          },
          prototype: {
            prototype_creation: { status: "in_progress", file: null },
            prototype_audit: { status: "in_progress", file: auditFile },
          },
          refactor: {},
        },
        last_updated: "2026-01-01T00:00:00.000Z",
        history: [],
      };
      await writeState(projectRoot, state);
      await writeSkill(projectRoot, "refactor-prototype");
      await writeFile(
        join(projectRoot, ".agents", "flow", auditFile),
        JSON.stringify({ summary: "Audit complete", issues: [] }, null, 2),
        "utf8",
      );

      const result = await runCli(["refactor", "prototype", "--agent", "ide"], projectRoot);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // US-003-AC13: sync skills
  it("US-003-AC13: nvst sync skills runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      await mkdir(join(projectRoot, ".agents", "skills", "test-skill"), { recursive: true });
      await mkdir(join(projectRoot, "scaffold", ".agents", "skills"), { recursive: true });
      await writeFile(
        join(projectRoot, ".agents", "skills", "test-skill", "SKILL.md"),
        "# Test skill\n\nContent.",
        "utf8",
      );

      const result = await runCli(["sync", "skills"], projectRoot);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Sync complete");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // US-003-AC14: write-json and write-technical-debt
  it("US-003-AC14a: nvst write-json runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      const outPath = join(projectRoot, "output.json");
      const data = JSON.stringify({
        goals: [],
        userStories: [],
        functionalRequirements: [],
      });

      const result = await runCli(
        ["write-json", "--schema", "prd", "--out", outPath, "--data", data],
        projectRoot,
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Written:");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("US-003-AC14b: nvst write-technical-debt runs without error", async () => {
    const projectRoot = await createTempDir();
    try {
      const data = JSON.stringify({
        items: [{ title: "Tech debt item", description: "Something to fix later." }],
      });

      const result = await runCli(["write-technical-debt", "--data", data], projectRoot);
      expect(result.exitCode).toBe(0);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  // US-003-AC15: Unknown commands/subcommands print error and exit with code 1
  it("US-003-AC15a: unknown top-level command prints error and exits with code 1", async () => {
    const result = await runCli(["totally-unknown-command-xyz"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown command: totally-unknown-command-xyz");
  });

  it("US-003-AC15b: unknown subcommand prints error and exits with code 1", async () => {
    const result = await runCli(["create", "totally-unknown-sub"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown create subcommand: totally-unknown-sub");
  });

  it("US-003-AC15c: unknown approve subcommand prints error and exits with code 1", async () => {
    const result = await runCli(["approve", "totally-unknown-sub"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown approve subcommand: totally-unknown-sub");
  });

  // US-003-AC16: -v / --version prints version string
  it("US-003-AC16a: nvst -v prints version string", async () => {
    const result = await runCli(["-v"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/\d+\.\d+/);
  });

  it("US-003-AC16b: nvst --version prints version string", async () => {
    const result = await runCli(["--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/\d+\.\d+/);
  });

  // US-003-AC17: Typecheck / lint passes
  it("US-003-AC17: typecheck passes without errors", async () => {
    const projectRoot = join(import.meta.dir, "..");
    const proc = Bun.spawn(["bun", "tsc", "--noEmit"], {
      cwd: projectRoot,
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(proc.exitCode).toBe(0);
    if (proc.exitCode !== 0) {
      console.error("TypeScript errors:", stderr);
    }
  }, 60_000);
});
