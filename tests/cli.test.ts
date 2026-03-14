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
    expect(result.stdout).toContain("create project-context --agent <provider>");
    expect(result.stdout).toContain("refine project-context --agent <provider>");
    expect(result.stdout).toContain("approve project-context [--force]");
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
});
