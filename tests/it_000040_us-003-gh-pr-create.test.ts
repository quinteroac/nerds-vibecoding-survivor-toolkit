/**
 * Tests for US-003: Create GitHub PR using extracted title and body
 * Iteration: 000040
 */
import { describe, it, expect } from "bun:test";
import { runApprovePrototype, NVST_PR_FOOTER } from "../src/commands/approve-prototype";
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
the PR title from the first user story.

## Goals
- Use the PRD markdown title as the PR title.
- Append a footer with a link to the GitHub repository.

## User Stories

### US-001: Extract PR title
Some content here.
`;

// ---------------------------------------------------------------------------
// US-003-AC01: gh pr create is called with --title and --body
// ---------------------------------------------------------------------------

describe("US-003-AC01: gh pr create called with extracted title and body", () => {
  it("passes a non-empty title to createPullRequestFn", async () => {
    const capturedTitles: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => FULL_PRD,
      createPullRequestFn: async (_: string, title: string) => {
        capturedTitles.push(title);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedTitles).toHaveLength(1);
    expect(capturedTitles[0]).toBeTruthy();
  });

  it("passes a non-empty body to createPullRequestFn", async () => {
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => FULL_PRD,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0]).toBeTruthy();
  });

  it("title includes the iteration prefix feat: it_000040", async () => {
    const capturedTitles: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => FULL_PRD,
      createPullRequestFn: async (_: string, title: string) => {
        capturedTitles.push(title);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedTitles[0]).toMatch(/^feat: it_000040/);
  });

  it("title includes the extracted PRD heading", async () => {
    const capturedTitles: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => FULL_PRD,
      createPullRequestFn: async (_: string, title: string) => {
        capturedTitles.push(title);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedTitles[0]).toContain("PR Metadata from PRD");
  });
});

// ---------------------------------------------------------------------------
// US-003-AC02: PR body ends with the "Made with NVST" footer
// ---------------------------------------------------------------------------

describe("US-003-AC02: PR body ends with Made with NVST footer", () => {
  it("PR body ends with the NVST footer when PRD is available", async () => {
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => FULL_PRD,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toEndWith(NVST_PR_FOOTER);
  });

  it("PR body ends with the NVST footer even when PRD is missing (fallback mode)", async () => {
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => null,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toEndWith(NVST_PR_FOOTER);
  });

  it("PR body ends with the NVST footer when PRD has no Context or Goals sections", async () => {
    const minimalPrd = `# Requirement: Minimal PRD\n\n## User Stories\n\n### US-001\nContent.\n`;
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => minimalPrd,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toEndWith(NVST_PR_FOOTER);
  });

  it("footer contains the NVST GitHub repository link", () => {
    expect(NVST_PR_FOOTER).toContain(
      "https://github.com/NerdsVibe/nerds-vibecoding-survivor-toolkit",
    );
  });

  it("footer is separated from preceding content by a blank line", async () => {
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
    const footerIdx = body.lastIndexOf(NVST_PR_FOOTER);
    expect(footerIdx).toBeGreaterThan(-1);
    // The content before the footer must end with \n\n (blank line separator)
    expect(body.slice(0, footerIdx)).toEndWith("\n\n");
  });
});
