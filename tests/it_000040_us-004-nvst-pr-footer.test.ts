/**
 * Tests for US-004: Append "Made with NVST" footer to PR body
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

const FULL_PRD = `# Requirement: NVST Footer Test

## Context
Some context about the change.

## Goals
- Append footer to PR body.

## User Stories

### US-004: Footer
Content.
`;

// ---------------------------------------------------------------------------
// US-004-AC01: Footer always ends PR body (PRD present)
// ---------------------------------------------------------------------------

describe("US-004-AC01: Footer at end of PR body when PRD is present", () => {
  it("PR body ends with the NVST footer line", async () => {
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
    expect(body).toContain(NVST_PR_FOOTER);
    expect(body.trimEnd()).toEndWith(NVST_PR_FOOTER.trimEnd());
  });

  it("footer contains the correct markdown link to the NVST repository", async () => {
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => FULL_PRD,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toContain(
      "[NVST](https://github.com/NerdsVibe/nerds-vibecoding-survivor-toolkit)",
    );
  });

  it("footer is preceded by a horizontal rule (---)", async () => {
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => FULL_PRD,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toContain("---\n_Made with");
  });
});

// ---------------------------------------------------------------------------
// US-004-AC02: Footer appended even in fallback (PRD not found)
// ---------------------------------------------------------------------------

describe("US-004-AC02: Footer appended even when PRD is missing (fallback)", () => {
  it("PR body ends with the NVST footer when readPrdMarkdownFn returns null", async () => {
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => null,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    const body = capturedBodies[0];
    expect(body).toContain(NVST_PR_FOOTER);
    expect(body.trimEnd()).toEndWith(NVST_PR_FOOTER.trimEnd());
  });

  it("footer link is present in fallback body", async () => {
    const capturedBodies: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => null,
      createPullRequestFn: async (_: string, __: string, body: string) => {
        capturedBodies.push(body);
        return { exitCode: 0, stderr: "" };
      },
    });

    await runApprovePrototype({}, deps);

    expect(capturedBodies[0]).toContain(
      "https://github.com/NerdsVibe/nerds-vibecoding-survivor-toolkit",
    );
  });
});

// ---------------------------------------------------------------------------
// US-004-AC03: NVST_PR_FOOTER constant has the expected exact value
// ---------------------------------------------------------------------------

describe("US-004-AC03: NVST_PR_FOOTER constant shape", () => {
  it("starts with --- (horizontal rule)", () => {
    expect(NVST_PR_FOOTER).toStartWith("---\n");
  });

  it("contains italic Made with NVST text", () => {
    expect(NVST_PR_FOOTER).toContain("_Made with");
  });

  it("contains NVST markdown link", () => {
    expect(NVST_PR_FOOTER).toContain(
      "[NVST](https://github.com/NerdsVibe/nerds-vibecoding-survivor-toolkit)",
    );
  });
});
