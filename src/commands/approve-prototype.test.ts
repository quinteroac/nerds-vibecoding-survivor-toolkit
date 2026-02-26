import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

import { writeState } from "../state";
import { runApprovePrototype } from "./approve-prototype";

async function createProjectRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-approve-prototype-"));
}

async function createBareRemoteRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-approve-prototype-remote-"));
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

async function runGit(projectRoot: string, command: string): Promise<string> {
  const result = await $`bash -lc ${command}`.cwd(projectRoot).nothrow().quiet();
  if (result.exitCode !== 0) {
    throw new Error(`git command failed: ${command}\n${result.stderr.toString()}`);
  }
  return result.stdout.toString().trim();
}

async function seedState(projectRoot: string, iteration = "000016"): Promise<void> {
  await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });
  await writeState(projectRoot, {
    current_iteration: iteration,
    current_phase: "prototype",
    phases: {
      define: {
        requirement_definition: { status: "approved", file: "it_000016_product-requirement-document.md" },
        prd_generation: { status: "completed", file: "it_000016_PRD.json" },
      },
      prototype: {
        project_context: { status: "created", file: ".agents/PROJECT_CONTEXT.md" },
        test_plan: { status: "created", file: "it_000016_test-plan.md" },
        tp_generation: { status: "created", file: "it_000016_TP.json" },
        prototype_build: { status: "created", file: "it_000016_progress.json" },
        test_execution: { status: "completed", file: "it_000016_test-execution-progress.json" },
        prototype_approved: false,
      },
      refactor: {
        evaluation_report: { status: "pending", file: null },
        refactor_plan: { status: "pending", file: null },
        refactor_execution: { status: "pending", file: null },
        changelog: { status: "pending", file: null },
      },
    },
    last_updated: "2026-02-26T00:00:00.000Z",
    updated_by: "seed",
    history: [],
  });
}

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  process.exitCode = 0;
});

describe("approve prototype command", () => {
  test("registers approve prototype command in CLI dispatch", async () => {
    const source = await Bun.file(join(process.cwd(), "src", "cli.ts")).text();

    expect(source).toContain('import { runApprovePrototype } from "./commands/approve-prototype";');
    expect(source).toContain('if (subcommand === "prototype") {');
    expect(source).toContain("await runApprovePrototype();");
  });

  test("stages all pending changes and creates conventional commit using current iteration", async () => {
    const projectRoot = await createProjectRoot();
    const remoteRoot = await createBareRemoteRoot();
    createdRoots.push(projectRoot);
    createdRoots.push(remoteRoot);

    await seedState(projectRoot, "000016");
    await runGit(projectRoot, "git init");
    await runGit(projectRoot, "git config user.email 'nvst@example.com'");
    await runGit(projectRoot, "git config user.name 'NVST Test'");
    await runGit(projectRoot, "git branch -M main");
    await runGit(remoteRoot, "git init --bare");
    await runGit(projectRoot, `git remote add origin ${remoteRoot}`);

    await writeFile(join(projectRoot, "tracked-modified.txt"), "before\n", "utf8");
    await writeFile(join(projectRoot, "tracked-deleted.txt"), "delete me\n", "utf8");
    await runGit(projectRoot, "git add -A && git commit -m 'chore: seed'");

    await writeFile(join(projectRoot, "tracked-modified.txt"), "after\n", "utf8");
    await rm(join(projectRoot, "tracked-deleted.txt"));
    await writeFile(join(projectRoot, "untracked-added.txt"), "new\n", "utf8");

    await withCwd(projectRoot, async () => {
      await runApprovePrototype();
    });

    const commitMessage = await runGit(projectRoot, "git log -1 --pretty=%s");
    expect(commitMessage).toBe("feat: approve prototype it_000016");

    const changedFiles = await runGit(projectRoot, "git show --name-status --pretty=format: HEAD");
    expect(changedFiles).toContain("tracked-modified.txt");
    expect(changedFiles).toContain("tracked-deleted.txt");
    expect(changedFiles).toContain("untracked-added.txt");

    const status = await runGit(projectRoot, "git status --porcelain");
    expect(status).toBe("");

    const upstream = await runGit(projectRoot, "git rev-parse --abbrev-ref --symbolic-full-name @{u}");
    expect(upstream).toBe("origin/main");
  });

  test("prints informative message and skips commit when working tree is clean", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);

    await seedState(projectRoot, "000016");
    await runGit(projectRoot, "git init");
    await runGit(projectRoot, "git config user.email 'nvst@example.com'");
    await runGit(projectRoot, "git config user.name 'NVST Test'");
    await writeFile(join(projectRoot, "tracked.txt"), "stable\n", "utf8");
    await runGit(projectRoot, "git add -A && git commit -m 'chore: seed'");

    const beforeHead = await runGit(projectRoot, "git rev-parse HEAD");
    const logs: string[] = [];

    await withCwd(projectRoot, async () => {
      await runApprovePrototype({
        logFn: (message) => {
          logs.push(message);
        },
      });
    });

    const afterHead = await runGit(projectRoot, "git rev-parse HEAD");
    const commitCount = await runGit(projectRoot, "git rev-list --count HEAD");

    expect(afterHead).toBe(beforeHead);
    expect(commitCount).toBe("1");
    expect(logs).toContain("No pending changes to commit; working tree is clean.");
  });

  test("throws descriptive error on push failure, sets process.exitCode, and does not update state.json", async () => {
    const projectRoot = await createProjectRoot();
    createdRoots.push(projectRoot);

    await seedState(projectRoot, "000016");
    await runGit(projectRoot, "git init");
    await runGit(projectRoot, "git config user.email 'nvst@example.com'");
    await runGit(projectRoot, "git config user.name 'NVST Test'");

    await writeFile(join(projectRoot, "tracked.txt"), "before\n", "utf8");
    await runGit(projectRoot, "git add -A && git commit -m 'chore: seed'");
    await writeFile(join(projectRoot, "tracked.txt"), "after\n", "utf8");

    const statePath = join(projectRoot, ".agents", "state.json");
    const beforeState = await Bun.file(statePath).text();
    process.exitCode = 0;

    let caught: unknown = null;
    await withCwd(projectRoot, async () => {
      try {
        await runApprovePrototype();
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("Failed to push prototype approval commit");
    expect(process.exitCode).toBe(1);

    const afterState = await Bun.file(statePath).text();
    expect(afterState).toBe(beforeState);
  });
});
