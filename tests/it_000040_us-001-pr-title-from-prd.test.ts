/**
 * Tests for US-001: Extract PR title from PRD markdown heading
 * Iteration: 000040
 */
import { describe, it, expect } from "bun:test";
import { runApprovePrototype } from "../src/commands/approve-prototype";
import type { State } from "../schemas/tmpl_state";

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

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
    // Only audit.md exists (not audit.json, not refactor-report), so guardrail passes
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
// US-001-AC01: reads the markdown PRD file
// ---------------------------------------------------------------------------

describe("US-001-AC01: reads markdown PRD file", () => {
  it("calls readPrdMarkdownFn with the correct markdown PRD path", async () => {
    const calls: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async (p: string) => {
        calls.push(p);
        return "# Requirement: My Feature\n\nBody text.";
      },
    });

    await runApprovePrototype({}, deps);

    expect(calls.some((p) => p.includes("it_000040_product-requirement-document.md"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// US-001-AC02: extracts heading text (without leading `# `)
// ---------------------------------------------------------------------------

describe("US-001-AC02: extracts first markdown heading as PR title", () => {
  it("uses extracted heading text (no `# Requirement: ` prefix) as PR title", async () => {
    const capturedTitles: string[] = [];
    const deps = makeDeps({
      checkGhAvailableFn: async () => true,
      readPrdMarkdownFn: async () => "# Requirement: My Feature Title\n\nBody.",
      createPullRequestFn: async (_: string, title: string) => {
        capturedTitles.push(title);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedTitles[0]).toContain("My Feature Title");
    expect(capturedTitles[0]).not.toContain("# ");
    expect(capturedTitles[0]).not.toContain("Requirement:");
  });
});

// ---------------------------------------------------------------------------
// US-001-AC03: `feat: it_{iteration} —` prefix is preserved
// ---------------------------------------------------------------------------

describe("US-001-AC03: PR title includes feat prefix with iteration", () => {
  it("formats PR title as `feat: it_000040 — <heading>`", async () => {
    const capturedTitles: string[] = [];
    const deps = makeDeps({
      checkGhAvailableFn: async () => true,
      readPrdMarkdownFn: async () =>
        "# Requirement: PR Metadata from PRD on Approve Prototype\n\nBody.",
      createPullRequestFn: async (_: string, title: string) => {
        capturedTitles.push(title);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedTitles[0]).toBe(
      "feat: it_000040 — PR Metadata from PRD on Approve Prototype",
    );
  });

  it("falls back to generic title when markdown PRD is missing, preserving prefix", async () => {
    const capturedTitles: string[] = [];
    const deps = makeDeps({
      checkGhAvailableFn: async () => true,
      readPrdMarkdownFn: async () => null,
      createPullRequestFn: async (_: string, title: string) => {
        capturedTitles.push(title);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedTitles[0]).toMatch(/^feat: it_000040 — /);
  });

  it("falls back to generic title when heading not found, preserving prefix", async () => {
    const capturedTitles: string[] = [];
    const deps = makeDeps({
      checkGhAvailableFn: async () => true,
      readPrdMarkdownFn: async () => "## No top-level heading here\n\nBody.",
      createPullRequestFn: async (_: string, title: string) => {
        capturedTitles.push(title);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedTitles[0]).toMatch(/^feat: it_000040 — /);
  });
});
