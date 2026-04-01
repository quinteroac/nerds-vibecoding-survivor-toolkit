/**
 * Tests for US-002: Build PR body from Context and Goals sections
 * Iteration: 000040
 */
import { describe, it, expect } from "bun:test";
import { runApprovePrototype, extractPrdSection } from "../src/commands/approve-prototype";
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

const FULL_PRD = `# Requirement: PR Metadata from PRD

## Context
When \`nvst approve prototype\` creates a GitHub Pull Request it currently derives
the PR title from the first user story. This means the PR carries no meaningful
description of why the change was made.

## Goals
- Use the PRD markdown title as the PR title.
- Populate the PR body with Context and Goals sections.
- Append a footer with a link to the GitHub repository.

## User Stories

### US-001: Extract PR title
Some content here.
`;

// ---------------------------------------------------------------------------
// Unit tests for extractPrdSection helper
// ---------------------------------------------------------------------------

describe("extractPrdSection helper", () => {
  it("extracts ## Context section including heading and body", () => {
    const result = extractPrdSection(FULL_PRD, "Context");
    expect(result).not.toBeNull();
    expect(result).toContain("## Context");
    expect(result).toContain("creates a GitHub Pull Request");
  });

  it("extracts ## Goals section including heading and bullet list", () => {
    const result = extractPrdSection(FULL_PRD, "Goals");
    expect(result).not.toBeNull();
    expect(result).toContain("## Goals");
    expect(result).toContain("- Use the PRD markdown title");
    expect(result).toContain("- Populate the PR body");
  });

  it("returns null when the section is absent", () => {
    const result = extractPrdSection(FULL_PRD, "NonExistent");
    expect(result).toBeNull();
  });

  it("does not include content from following sections", () => {
    const result = extractPrdSection(FULL_PRD, "Context");
    expect(result).not.toContain("## Goals");
    expect(result).not.toContain("## User Stories");
  });
});

// ---------------------------------------------------------------------------
// US-002-AC01: ## Context section is included in PR body
// ---------------------------------------------------------------------------

describe("US-002-AC01: Context section included in PR body", () => {
  it("includes the ## Context heading and body text in the PR body", async () => {
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => FULL_PRD,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toContain("## Context");
    expect(capturedBodies[0]).toContain("creates a GitHub Pull Request");
  });
});

// ---------------------------------------------------------------------------
// US-002-AC02: ## Goals section is included in PR body
// ---------------------------------------------------------------------------

describe("US-002-AC02: Goals section included in PR body", () => {
  it("includes the ## Goals heading and bullet list in the PR body", async () => {
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => FULL_PRD,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toContain("## Goals");
    expect(capturedBodies[0]).toContain("- Use the PRD markdown title");
    expect(capturedBodies[0]).toContain("- Populate the PR body");
  });
});

// ---------------------------------------------------------------------------
// US-002-AC03: Sections separated by blank line
// ---------------------------------------------------------------------------

describe("US-002-AC03: Sections separated by blank line", () => {
  it("separates sections with a blank line (double newline)", async () => {
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => FULL_PRD,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    const body = capturedBodies[0];
    // Context and Goals sections should be separated by blank lines (\n\n)
    const contextIdx = body.indexOf("## Context");
    const goalsIdx = body.indexOf("## Goals");
    expect(contextIdx).toBeGreaterThan(-1);
    expect(goalsIdx).toBeGreaterThan(contextIdx);

    // There must be a \n\n between end of Context block and start of Goals
    const between = body.slice(contextIdx, goalsIdx);
    expect(between).toContain("\n\n");
  });
});

// ---------------------------------------------------------------------------
// US-002-AC04: Missing sections do not cause failure; present section included
// ---------------------------------------------------------------------------

describe("US-002-AC04: Missing sections are handled gracefully", () => {
  it("includes Goals even when Context is absent, without throwing", async () => {
    const prdWithoutContext = `# Requirement: Partial PRD

## Goals
- First goal.
- Second goal.

## User Stories

### US-001: Something
`;
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => prdWithoutContext,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toContain("## Goals");
    expect(capturedBodies[0]).not.toContain("## Context");
  });

  it("includes Context even when Goals is absent, without throwing", async () => {
    const prdWithoutGoals = `# Requirement: Partial PRD

## Context
Some context about this change.

## User Stories

### US-001: Something
`;
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => prdWithoutGoals,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toContain("## Context");
    expect(capturedBodies[0]).toContain("Some context about this change.");
    expect(capturedBodies[0]).not.toContain("## Goals");
  });

  it("still creates a PR body when PRD is missing entirely", async () => {
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
    expect(capturedBodies[0]).toContain("Refactor report:");
  });

  it("still creates a PR body when both sections are absent from PRD", async () => {
    const prdNoSections = `# Requirement: Minimal PRD\n\n## User Stories\n\n### US-001\nContent.\n`;
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => prdNoSections,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toBeTruthy();
    expect(capturedBodies[0]).toContain("Refactor report:");
  });
});
