/**
 * Tests for US-005: Fallback when PRD markdown is missing or unparseable
 * Iteration: 000040
 */
import { describe, it, expect } from "bun:test";
import { runApprovePrototype, NVST_PR_FOOTER } from "../src/commands/approve-prototype";
import type { State } from "../schemas/tmpl_state";

function makeState(iteration = "000040"): State {
  return {
    current_iteration: iteration,
    flow_guardrail: "off",
    phases: {
      prototype: {
        prototype_approval: { status: "pending", file: null },
        prototype_audit: { status: "completed", file: "audit.md" },
        prototype_refactor: { status: "completed", file: "refactor.md" },
        prototype_creation: { status: "completed", file: "prototype.md" },
      },
      requirement: {
        requirement_definition: { status: "completed", file: "req.md" },
        requirement_refinement: { status: null, file: null },
        requirement_approval: { status: "completed", file: "req.md" },
      },
    },
    project_name: "test-project",
    last_updated: "2026-01-01T00:00:00.000Z",
    updated_by: "test",
  } as unknown as State;
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    existsFn: async (p: string) => p.includes("audit.md"),
    logFn: () => {},
    warnFn: () => {},
    readStateFn: async () => makeState(),
    loadSkillFn: async () => "skill body",
    invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    readChangedFilesFn: async () => ["some-file.ts"],
    promptGitOpsConfirmationFn: async () => true,
    gitAddAndCommitFn: async () => {},
    getCurrentBranchFn: async () => "feature/it_000040-test",
    gitPushFn: async () => {},
    checkGhAvailableFn: async () => true,
    createPullRequestFn: async () => ({ exitCode: 0, stderr: "" }),
    writeStateFn: async () => {},
    readPrdMarkdownFn: async () => null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// US-005-AC01: Missing PRD file → warning logged + default title/body used
// ---------------------------------------------------------------------------

describe("US-005-AC01: PRD file missing — warning logged and default title used", () => {
  it("logs a warning when readPrdMarkdownFn returns null", async () => {
    const warnings: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => null,
      warnFn: (msg: string) => warnings.push(msg),
    });

    await runApprovePrototype({}, deps);

    expect(warnings.some((w) => w.toLowerCase().includes("missing") || w.toLowerCase().includes("unable"))).toBe(true);
  });

  it("uses the default fallback title when PRD is missing", async () => {
    const capturedTitles: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => null,
      createPullRequestFn: async (_: string, title: string) => {
        capturedTitles.push(title);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedTitles[0]).toContain("approve prototype iteration it_000040");
  });

  it("PR body still contains content when PRD is missing", async () => {
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => null,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toBeTruthy();
    expect(capturedBodies[0].length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// US-005-AC02: File exists but no `# Heading` → warning logged + default used
// ---------------------------------------------------------------------------

describe("US-005-AC02: PRD exists but no # Heading — warning logged and default title used", () => {
  it("logs a warning when PRD has no # Requirement: heading", async () => {
    const warnings: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => "## Goals\nSome goals here.\n\n## Context\nNo heading.",
      warnFn: (msg: string) => warnings.push(msg),
    });

    await runApprovePrototype({}, deps);

    expect(warnings.some((w) => w.includes("heading") || w.includes("Unable"))).toBe(true);
  });

  it("uses the default fallback title when no # Requirement: heading is found", async () => {
    const capturedTitles: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => "## Goals\nNo top-level heading here.",
      createPullRequestFn: async (_: string, title: string) => {
        capturedTitles.push(title);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedTitles[0]).toContain("approve prototype iteration it_000040");
  });

  it("uses the default fallback title when file is empty", async () => {
    const capturedTitles: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => "",
      createPullRequestFn: async (_: string, title: string) => {
        capturedTitles.push(title);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedTitles[0]).toContain("approve prototype iteration it_000040");
  });
});

// ---------------------------------------------------------------------------
// US-005-AC03: Command never throws / exits non-zero due to PRD parsing failure
// ---------------------------------------------------------------------------

describe("US-005-AC03: No throw or non-zero exit on PRD parse failure", () => {
  it("does not throw when PRD file is missing", async () => {
    const deps = makeDeps({
      readPrdMarkdownFn: async () => null,
    });

    await expect(runApprovePrototype({}, deps)).resolves.toBeUndefined();
  });

  it("does not throw when PRD has no heading", async () => {
    const deps = makeDeps({
      readPrdMarkdownFn: async () => "## Context\nNo heading.",
    });

    await expect(runApprovePrototype({}, deps)).resolves.toBeUndefined();
  });

  it("does not throw when PRD is empty string", async () => {
    const deps = makeDeps({
      readPrdMarkdownFn: async () => "",
    });

    await expect(runApprovePrototype({}, deps)).resolves.toBeUndefined();
  });

  it("does not throw when PRD has only whitespace", async () => {
    const deps = makeDeps({
      readPrdMarkdownFn: async () => "   \n\n   \t   ",
    });

    await expect(runApprovePrototype({}, deps)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// US-005-AC04: NVST footer appended in fallback mode
// ---------------------------------------------------------------------------

describe("US-005-AC04: NVST footer appended in fallback mode", () => {
  it("footer is appended when PRD file is missing", async () => {
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => null,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toContain(NVST_PR_FOOTER);
    expect(capturedBodies[0].trimEnd()).toEndWith(NVST_PR_FOOTER.trimEnd());
  });

  it("footer is appended when PRD has no # heading", async () => {
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => "## Context\nNo title heading.",
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toContain(NVST_PR_FOOTER);
    expect(capturedBodies[0].trimEnd()).toEndWith(NVST_PR_FOOTER.trimEnd());
  });

  it("footer contains Made with NVST text in fallback mode", async () => {
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => null,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toContain("Made with");
    expect(capturedBodies[0]).toContain(
      "[NVST](https://github.com/NerdsVibe/nerds-vibecoding-survivor-toolkit)",
    );
  });
});
