import { describe, it, expect } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { extractFlagValue } from "../src/cli";

const CLI_PATH = join(import.meta.dir, "..", "src", "cli.ts");

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function createBaseState(): any {
  return {
    current_iteration: "000001",
    current_phase: "define",
    phases: {
      define: {
        requirement_definition: { status: "approved", file: "it_000001_product-requirement-document.md" },
        prd_generation: { status: "completed", file: "it_000001_PRD.json" },
      },
      prototype: {
        prototype_creation: { status: "pending", file: null },
        prototype_audit: { status: "pending", file: null },
        prototype_refactor: { status: "pending", file: null },
        prototype_approval: { status: "pending", file: null },
        project_context: { status: "pending", file: null },
      },
      refactor: {},
    },
    last_updated: "2026-01-01T00:00:00.000Z",
    history: [],
  };
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

async function createTempProject(state: unknown): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), "nvst-cli-routing-"));
  await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });
  await mkdir(join(projectRoot, ".agents", "skills", "create-project-context"), { recursive: true });
  await mkdir(join(projectRoot, ".agents", "skills", "refine-project-context"), { recursive: true });

  await writeFile(
    join(projectRoot, ".agents", "state.json"),
    JSON.stringify(state, null, 2),
    "utf8",
  );
  await writeFile(
    join(projectRoot, ".agents", "flow", "it_000001_PRD.json"),
    JSON.stringify({ title: "PRD" }, null, 2),
    "utf8",
  );
  await writeFile(
    join(projectRoot, ".agents", "skills", "create-project-context", "SKILL.md"),
    "# Create project context skill",
    "utf8",
  );
  await writeFile(
    join(projectRoot, ".agents", "skills", "refine-project-context", "SKILL.md"),
    "# Refine project context skill",
    "utf8",
  );
  await writeFile(
    join(projectRoot, ".agents", "PROJECT_CONTEXT.md"),
    "# Project Context",
    "utf8",
  );

  return projectRoot;
}

describe("extractFlagValue", () => {
  it("returns the flag value and remaining args when the flag is present", () => {
    const args = ["nvst", "create", "--agent", "ide", "--foo", "bar", "baz"];

    const result = extractFlagValue(args, "--foo");

    expect(result.value).toBe("bar");
    expect(result.remainingArgs).toEqual(["nvst", "create", "--agent", "ide", "baz"]);
  });

  it("returns null and original args when the flag is absent", () => {
    const args = ["nvst", "define", "requirement", "--agent", "ide"];

    const result = extractFlagValue(args, "--missing");

    expect(result.value).toBeNull();
    expect(result.remainingArgs).toEqual(args);
  });

  it("throws an error when the flag is present but has no following value", () => {
    const args = ["--foo"];

    expect(() => extractFlagValue(args, "--foo")).toThrow("Missing value for --foo.");
  });
});

describe("CLI routing", () => {
  it("prints an error and usage, and exits with code 1 for an unknown command", async () => {
    const proc = Bun.spawn([process.argv[0], "src/cli.ts", "foobar"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await proc.exited;

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    expect(proc.exitCode).toBe(1);
    expect(stderr).toContain("Unknown command: foobar");
    expect(stdout).toContain("Usage: nvst");
  });

  it("routes create project-context to the command handler without unknown-command errors", async () => {
    const state = createBaseState();
    const projectRoot = await createTempProject(state);

    try {
      const result = await runCli(["create", "project-context", "--agent", "ide"], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stderr).not.toContain("Unknown create subcommand");
      expect(result.stdout).toContain("Project context generated and marked as pending approval.");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("routes approve project-context to the command handler without unknown-command errors", async () => {
    const state = createBaseState();
    state.phases.prototype.project_context = {
      status: "pending_approval",
      file: ".agents/PROJECT_CONTEXT.md",
    };
    const projectRoot = await createTempProject(state);

    try {
      const result = await runCli(["approve", "project-context"], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stderr).not.toContain("Unknown approve subcommand");
      expect(result.stdout).toContain("Project context approved.");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("routes refine project-context to the command handler without unknown-command errors", async () => {
    const state = createBaseState();
    state.phases.prototype.project_context = {
      status: "created",
      file: ".agents/PROJECT_CONTEXT.md",
    };
    const projectRoot = await createTempProject(state);

    try {
      const result = await runCli(["refine", "project-context", "--agent", "ide"], projectRoot);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stderr).not.toContain("Unknown refine subcommand");
      expect(result.stdout).toContain("Project context refined and marked as pending approval.");
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("shows project-context workflow commands in --help output", async () => {
    const result = await runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("create");
    expect(result.stdout).toContain("define");
    expect(result.stdout).toContain("refine");
    expect(result.stdout).toContain("approve");
  });

  // US-001-AC01: --help exits 0 and prints commander-generated listing
  it("US-001-AC01: --help exits with code 0 and prints commander-generated help", async () => {
    const result = await runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: nvst");
  });

  // US-001-AC02: -h produces identical output to --help
  it("US-001-AC02: -h produces identical output to --help", async () => {
    const helpResult = await runCli(["--help"]);
    const hResult = await runCli(["-h"]);

    expect(hResult.exitCode).toBe(0);
    expect(hResult.stdout).toBe(helpResult.stdout);
  });

  // US-001-AC03: output includes all top-level commands
  it("US-001-AC03: --help lists all top-level commands", async () => {
    const result = await runCli(["--help"]);

    expect(result.exitCode).toBe(0);
    const commands = [
      "ideate",
      "start",
      "define",
      "refine",
      "approve",
      "create",
      "audit",
      "refactor",
      "sync",
      "init",
      "destroy",
      "write-json",
      "write-technical-debt",
    ];
    for (const cmd of commands) {
      expect(result.stdout).toContain(cmd);
    }
  });

  it("keeps unknown create subcommand usage errors", async () => {
    const result = await runCli(["create", "not-a-subcommand"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown create subcommand: not-a-subcommand");
    expect(result.stdout).toContain("Usage: nvst");
  });

  it("keeps unknown approve subcommand usage errors", async () => {
    const result = await runCli(["approve", "not-a-subcommand"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown approve subcommand: not-a-subcommand");
    expect(result.stdout).toContain("Usage: nvst");
  });

  it("keeps unknown refine subcommand usage errors", async () => {
    const result = await runCli(["refine", "not-a-subcommand"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown refine subcommand: not-a-subcommand");
    expect(result.stdout).toContain("Usage: nvst");
  });

  // US-002-AC01: `bun nvst create prototype --help` exits 0 and lists all flags
  it("US-002-AC01: create prototype --help exits 0 and lists scoped flags", async () => {
    const result = await runCli(["create", "prototype", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--agent");
    expect(result.stdout).toContain("--iterations");
    expect(result.stdout).toContain("--retry-on-fail");
    expect(result.stdout).toContain("--stop-on-critical");
    expect(result.stdout).toContain("--force");
  });

  // US-002-AC01: -h alias also works for create prototype
  it("US-002-AC01: create prototype -h exits 0 and lists scoped flags", async () => {
    const result = await runCli(["create", "prototype", "-h"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--agent");
    expect(result.stdout).toContain("--iterations");
    expect(result.stdout).toContain("--retry-on-fail");
    expect(result.stdout).toContain("--stop-on-critical");
    expect(result.stdout).toContain("--force");
  });

  // US-002-AC02: every command responds to --help with scoped output
  it("US-002-AC02: ideate --help exits 0 with scoped output", async () => {
    const result = await runCli(["ideate", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--agent");
    expect(result.stdout).toContain("--force");
  });

  it("US-002-AC02: define requirement --help exits 0 with scoped output", async () => {
    const result = await runCli(["define", "requirement", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--agent");
    expect(result.stdout).toContain("--force");
  });

  it("US-002-AC02: define --help exits 0 with command-level output", async () => {
    const result = await runCli(["define", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("requirement");
  });

  it("US-002-AC02: refine requirement --help exits 0 with scoped output", async () => {
    const result = await runCli(["refine", "requirement", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--agent");
    expect(result.stdout).toContain("--challenge");
    expect(result.stdout).toContain("--force");
  });

  it("US-002-AC02: refine project-context --help exits 0 with scoped output", async () => {
    const result = await runCli(["refine", "project-context", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--agent");
    expect(result.stdout).toContain("--challenge");
    expect(result.stdout).toContain("--force");
  });

  it("US-002-AC02: approve requirement --help exits 0 with scoped output", async () => {
    const result = await runCli(["approve", "requirement", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--force");
  });

  it("US-002-AC02: approve project-context --help exits 0 with scoped output", async () => {
    const result = await runCli(["approve", "project-context", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--force");
  });

  it("US-002-AC02: approve prototype --help exits 0 with scoped output", async () => {
    const result = await runCli(["approve", "prototype", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--force");
  });

  it("US-002-AC02: create project-context --help exits 0 with scoped output", async () => {
    const result = await runCli(["create", "project-context", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--agent");
    expect(result.stdout).toContain("--mode");
    expect(result.stdout).toContain("--force");
  });

  it("US-002-AC02: audit prototype --help exits 0 with scoped output", async () => {
    const result = await runCli(["audit", "prototype", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--agent");
    expect(result.stdout).toContain("--force");
  });

  it("US-002-AC02: refactor prototype --help exits 0 with scoped output", async () => {
    const result = await runCli(["refactor", "prototype", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--agent");
    expect(result.stdout).toContain("--force");
  });

  it("US-002-AC02: destroy --help exits 0 with scoped output", async () => {
    const result = await runCli(["destroy", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--clean");
  });

  it("US-002-AC02: init --help exits 0 with scoped output", async () => {
    const result = await runCli(["init", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("init");
  });

  it("US-002-AC02: sync skills --help exits 0 with scoped output", async () => {
    const result = await runCli(["sync", "skills", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("skills");
  });

  it("US-002-AC02: write-json --help exits 0 with scoped output", async () => {
    const result = await runCli(["write-json", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--schema");
    expect(result.stdout).toContain("--out");
  });

  it("US-002-AC02: write-technical-debt --help exits 0 with scoped output", async () => {
    const result = await runCli(["write-technical-debt", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--out");
  });

  it("US-002-AC02: start --help exits 0 with command-level output", async () => {
    const result = await runCli(["start", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("iteration");
  });

  it("US-002-AC02: start iteration --help exits 0 with scoped output", async () => {
    const result = await runCli(["start", "iteration", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("iteration");
  });
});
