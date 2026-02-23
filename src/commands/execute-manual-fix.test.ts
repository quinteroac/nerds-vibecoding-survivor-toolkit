import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeState } from "../state";
import { runExecuteManualFix } from "./execute-manual-fix";

async function createProjectRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-execute-manual-fix-"));
}

async function withCwd<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

async function seedState(projectRoot: string, iteration = "000010") {
  await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });
  await writeState(projectRoot, {
    current_iteration: iteration,
    current_phase: "prototype",
    phases: {
      define: {
        requirement_definition: { status: "approved", file: `it_${iteration}_product-requirement-document.md` },
        prd_generation: { status: "completed", file: `it_${iteration}_PRD.json` },
      },
      prototype: {
        project_context: { status: "created", file: ".agents/PROJECT_CONTEXT.md" },
        test_plan: { status: "pending", file: null },
        tp_generation: { status: "pending", file: null },
        prototype_build: { status: "pending", file: null },
        test_execution: { status: "pending", file: null },
        prototype_approved: false,
      },
      refactor: {
        evaluation_report: { status: "pending", file: null },
        refactor_plan: { status: "pending", file: null },
        refactor_execution: { status: "pending", file: null },
        changelog: { status: "pending", file: null },
      },
    },
    last_updated: "2026-02-23T00:00:00.000Z",
    updated_by: "seed",
    history: [],
  });
}

async function writeIssues(projectRoot: string, iteration: string, data: unknown) {
  const issuesPath = join(projectRoot, ".agents", "flow", `it_${iteration}_ISSUES.json`);
  await writeFile(issuesPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return issuesPath;
}

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("execute manual-fix command", () => {
  test("registers execute manual-fix command in CLI", async () => {
    const source = await readFile(join(process.cwd(), "src", "cli.ts"), "utf8");

    expect(source).toContain('import { runExecuteManualFix } from "./commands/execute-manual-fix";');
    expect(source).toContain('if (subcommand === "manual-fix") {');
    expect(source).toContain("await runExecuteManualFix({ provider });");
    expect(source).toContain("execute manual-fix --agent <provider>");
  });

  test("CLI exits with code 1 when --agent is missing", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli.ts", "execute", "manual-fix"],
      { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Missing required --agent <provider> argument.");
  });

  test("CLI accepts --agent and rejects unknown providers", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli.ts", "execute", "manual-fix", "--agent", "invalid-provider"],
      { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown agent provider");
  });

  test("scans issues for current iteration, filters manual-fix status, prints count, and prompts to proceed", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);

    await seedState(projectRoot, "000010");
    await writeIssues(projectRoot, "000010", [
      { id: "ISSUE-000010-001", title: "Open", description: "skip", status: "open" },
      { id: "ISSUE-000010-002", title: "Manual A", description: "take", status: "manual-fix" },
      { id: "ISSUE-000010-003", title: "Retry", description: "skip", status: "retry" },
      { id: "ISSUE-000010-004", title: "Manual B", description: "take", status: "manual-fix" },
    ]);

    const logs: string[] = [];
    const prompts: string[] = [];

    await withCwd(projectRoot, async () => {
      await runExecuteManualFix(
        { provider: "codex" },
        {
          logFn: (message) => logs.push(message),
          promptProceedFn: async (question) => {
            prompts.push(question);
            return false;
          },
        },
      );
    });

    expect(logs).toContain(
      "Found 2 issue(s) with status 'manual-fix' in .agents/flow/it_000010_ISSUES.json.",
    );
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("Proceed with manual-fix processing for 2 issue(s)");
    expect(logs).toContain("Manual-fix execution cancelled.");
  });
});
