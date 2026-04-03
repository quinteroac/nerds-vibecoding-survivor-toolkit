/**
 * Tests for US-008: `approve prototype` consolidates all PRDs into a single CHANGELOG entry and PR
 * Iteration: 000044
 */
import { describe, it, expect } from "bun:test";
import {
  buildMultiPrdChangelogBullets,
  runApprovePrototype,
  NVST_PR_FOOTER,
} from "../src/commands/approve-prototype";
import type { State } from "../src/schemas/tmpl_state";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const PRD_001 = `# Requirement: Feature Alpha

## Context
Context for feature alpha.

## Goals
- Alpha goal one
- Alpha goal two

## User Stories
### US-001
Some story.
`;

const PRD_002 = `# Requirement: Feature Beta

## Context
Context for feature beta.

## Goals
- Beta goal one
- Beta goal two

## User Stories
### US-002
Another story.
`;

const PRD_NO_GOALS = `# Requirement: Feature Gamma

## Context
Context for gamma.

## User Stories
### US-003
Third story.
`;

function makeState(
  reqDefs: State["phases"]["define"]["requirement_definition"],
  iteration = "000044",
): State {
  return {
    current_iteration: iteration,
    current_phase: "define",
    flow_guardrail: "relaxed",
    last_updated: "2026-01-01T00:00:00.000Z",
    phases: {
      define: {
        requirement_definition: reqDefs,
        prd_generation: { status: "pending", file: null },
      },
      prototype: {},
      refactor: {},
    },
  };
}

function makeDeps(
  prdMap: Record<string, string>,
  overrides: Record<string, unknown> = {},
) {
  const capturedChangelogWrites: string[] = [];
  const capturedPrTitles: string[] = [];
  const capturedPrBodies: string[] = [];

  const deps = {
    existsFn: async (p: string) => p.includes("audit.md"),
    logFn: () => {},
    warnFn: () => {},
    readStateFn: async () =>
      makeState([
        { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
        { index: 2, status: "approved", file: "it_000044_product-requirement-document_002.md" },
      ]),
    loadSkillFn: async () => "skill body",
    invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    readChangedFilesFn: async () => ["some-file.ts"],
    promptGitOpsConfirmationFn: async () => true,
    gitAddAndCommitFn: async () => {},
    getCurrentBranchFn: async () => "feature/it_000044-test",
    gitPushFn: async () => {},
    checkGhAvailableFn: async () => true,
    createPullRequestFn: async (_: string, title: string, body: string) => {
      capturedPrTitles.push(title);
      capturedPrBodies.push(body);
      return { exitCode: 0, stderr: "" };
    },
    writeStateFn: async () => {},
    readPrdMarkdownFn: async (path: string) => {
      const filename = path.split("/").pop() ?? path;
      return prdMap[filename] ?? null;
    },
    readChangelogFn: async () => null,
    writeChangelogFn: async (_: string, content: string) => {
      capturedChangelogWrites.push(content);
    },
    ...overrides,
  };

  return { deps, capturedChangelogWrites, capturedPrTitles, capturedPrBodies };
}

// ---------------------------------------------------------------------------
// Pure function: buildMultiPrdChangelogBullets
// ---------------------------------------------------------------------------

describe("buildMultiPrdChangelogBullets", () => {
  it("returns bullets without prefix for a single PRD", () => {
    const entries = [
      { index: 1, title: "Feature Alpha", goals: "## Goals\n- Alpha goal one\n- Alpha goal two" },
    ];
    const bullets = buildMultiPrdChangelogBullets(entries);
    expect(bullets).toEqual(["- Alpha goal one", "- Alpha goal two"]);
  });

  it("returns bullets with PRD prefix for multiple PRDs", () => {
    const entries = [
      { index: 1, title: "Feature Alpha", goals: "## Goals\n- Alpha goal one" },
      { index: 2, title: "Feature Beta", goals: "## Goals\n- Beta goal one" },
    ];
    const bullets = buildMultiPrdChangelogBullets(entries);
    expect(bullets).toEqual([
      "- **PRD 001 — Feature Alpha:** Alpha goal one",
      "- **PRD 002 — Feature Beta:** Beta goal one",
    ]);
  });

  it("pads PRD index to 3 digits in prefix", () => {
    const entries = [
      { index: 1, title: "A", goals: "## Goals\n- goal" },
      { index: 2, title: "B", goals: "## Goals\n- goal" },
    ];
    const bullets = buildMultiPrdChangelogBullets(entries);
    expect(bullets[0]).toContain("PRD 001");
    expect(bullets[1]).toContain("PRD 002");
  });

  it("uses index-only label when title is null", () => {
    const entries = [
      { index: 1, title: null, goals: "## Goals\n- g1" },
      { index: 2, title: null, goals: "## Goals\n- g2" },
    ];
    const bullets = buildMultiPrdChangelogBullets(entries);
    expect(bullets[0]).toContain("**PRD 001:**");
    expect(bullets[1]).toContain("**PRD 002:**");
  });

  it("skips PRD entries with no goals section", () => {
    const entries = [
      { index: 1, title: "A", goals: null },
      { index: 2, title: "B", goals: "## Goals\n- real goal" },
    ];
    const bullets = buildMultiPrdChangelogBullets(entries);
    // Only one non-null entry so no prefix
    expect(bullets).toEqual(["- real goal"]);
  });

  it("skips PRD entries with empty goals section", () => {
    const entries = [
      { index: 1, title: "A", goals: "## Goals\n" },
      { index: 2, title: "B", goals: "## Goals\n- b1" },
      { index: 3, title: "C", goals: "## Goals\n- c1" },
    ];
    const bullets = buildMultiPrdChangelogBullets(entries);
    // Two PRDs with bullets → prefix applied
    expect(bullets).toContain("- **PRD 002 — B:** b1");
    expect(bullets).toContain("- **PRD 003 — C:** c1");
  });

  it("returns empty array when all entries have no goals", () => {
    const entries = [
      { index: 1, title: "A", goals: null },
      { index: 2, title: "B", goals: "## Goals\n" },
    ];
    expect(buildMultiPrdChangelogBullets(entries)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// US-008-AC01: reads all PRD entries from requirement_definition array
// ---------------------------------------------------------------------------

describe("US-008-AC01: reads all PRD entries from requirement_definition", () => {
  it("calls readPrdMarkdownFn for each file in requirement_definition", async () => {
    const readCalls: string[] = [];
    const { deps } = makeDeps(
      {
        "it_000044_product-requirement-document_001.md": PRD_001,
        "it_000044_product-requirement-document_002.md": PRD_002,
      },
      {
        readPrdMarkdownFn: async (path: string) => {
          readCalls.push(path);
          if (path.endsWith("_001.md")) return PRD_001;
          if (path.endsWith("_002.md")) return PRD_002;
          return null;
        },
      },
    );

    await runApprovePrototype({}, deps);

    expect(readCalls.some((p) => p.includes("_001.md"))).toBe(true);
    expect(readCalls.some((p) => p.includes("_002.md"))).toBe(true);
  });

  it("processes entries in index order (ascending)", async () => {
    const readOrder: number[] = [];
    const { deps } = makeDeps(
      {},
      {
        readStateFn: async () =>
          makeState([
            { index: 2, status: "approved", file: "it_000044_prd_002.md" },
            { index: 1, status: "approved", file: "it_000044_prd_001.md" },
          ]),
        readPrdMarkdownFn: async (path: string) => {
          if (path.endsWith("_001.md")) { readOrder.push(1); return PRD_001; }
          if (path.endsWith("_002.md")) { readOrder.push(2); return PRD_002; }
          return null;
        },
      },
    );

    await runApprovePrototype({}, deps);

    expect(readOrder[0]).toBe(1);
    expect(readOrder[1]).toBe(2);
  });

  it("skips entries whose file field is null", async () => {
    const readCalls: string[] = [];
    const { deps } = makeDeps(
      {},
      {
        readStateFn: async () =>
          makeState([
            { index: 1, status: "approved", file: null },
            { index: 2, status: "approved", file: "it_000044_prd_002.md" },
          ]),
        readPrdMarkdownFn: async (path: string) => {
          readCalls.push(path);
          if (path.endsWith("_002.md")) return PRD_002;
          return null;
        },
      },
    );

    await runApprovePrototype({}, deps);

    // Only the non-null file should have been read
    expect(readCalls.filter((p) => p.endsWith("_002.md"))).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// US-008-AC02: CHANGELOG entry includes goals from all PRDs with prefix
// ---------------------------------------------------------------------------

describe("US-008-AC02: CHANGELOG entry merges goals from all PRDs", () => {
  it("includes goals from both PRDs in CHANGELOG when two PRDs exist", async () => {
    const { deps, capturedChangelogWrites } = makeDeps({
      "it_000044_product-requirement-document_001.md": PRD_001,
      "it_000044_product-requirement-document_002.md": PRD_002,
    });

    await runApprovePrototype({}, deps);

    expect(capturedChangelogWrites).toHaveLength(1);
    const changelog = capturedChangelogWrites[0];
    expect(changelog).toContain("Alpha goal one");
    expect(changelog).toContain("Alpha goal two");
    expect(changelog).toContain("Beta goal one");
    expect(changelog).toContain("Beta goal two");
  });

  it("prefixes each goal group with the PRD title when multiple PRDs exist", async () => {
    const { deps, capturedChangelogWrites } = makeDeps({
      "it_000044_product-requirement-document_001.md": PRD_001,
      "it_000044_product-requirement-document_002.md": PRD_002,
    });

    await runApprovePrototype({}, deps);

    const changelog = capturedChangelogWrites[0];
    expect(changelog).toContain("**PRD 001 — Feature Alpha:**");
    expect(changelog).toContain("**PRD 002 — Feature Beta:**");
  });

  it("includes ### Added section in changelog entry", async () => {
    const { deps, capturedChangelogWrites } = makeDeps({
      "it_000044_product-requirement-document_001.md": PRD_001,
      "it_000044_product-requirement-document_002.md": PRD_002,
    });

    await runApprovePrototype({}, deps);

    expect(capturedChangelogWrites[0]).toContain("### Added");
  });

  it("warns and skips changelog when no PRD files are found and no legacy path exists", async () => {
    const warnMessages: string[] = [];
    const { deps, capturedChangelogWrites } = makeDeps(
      {},
      {
        readStateFn: async () =>
          makeState([
            { index: 1, status: "approved", file: null },
          ]),
        readPrdMarkdownFn: async () => null,
        warnFn: (msg: string) => { warnMessages.push(msg); },
      },
    );

    await runApprovePrototype({}, deps);

    expect(capturedChangelogWrites).toHaveLength(0);
    expect(warnMessages.some((m) => m.toLowerCase().includes("skipping changelog"))).toBe(true);
  });

  it("skips PRD with no Goals section but still includes others", async () => {
    const { deps, capturedChangelogWrites } = makeDeps({
      "it_000044_product-requirement-document_001.md": PRD_NO_GOALS,
      "it_000044_product-requirement-document_002.md": PRD_002,
    });

    await runApprovePrototype({}, deps);

    // Only PRD_002 goals should be in changelog
    expect(capturedChangelogWrites[0]).toContain("Beta goal one");
    expect(capturedChangelogWrites[0]).not.toContain("Alpha goal");
  });
});

// ---------------------------------------------------------------------------
// US-008-AC03: PR body includes context, goals from all PRDs in order
// ---------------------------------------------------------------------------

describe("US-008-AC03: PR body includes sections from all PRDs", () => {
  it("includes Context from both PRDs in PR body", async () => {
    const { deps, capturedPrBodies } = makeDeps({
      "it_000044_product-requirement-document_001.md": PRD_001,
      "it_000044_product-requirement-document_002.md": PRD_002,
    });

    await runApprovePrototype({}, deps);

    expect(capturedPrBodies).toHaveLength(1);
    const body = capturedPrBodies[0];
    expect(body).toContain("Context for feature alpha.");
    expect(body).toContain("Context for feature beta.");
  });

  it("includes Goals from both PRDs in PR body", async () => {
    const { deps, capturedPrBodies } = makeDeps({
      "it_000044_product-requirement-document_001.md": PRD_001,
      "it_000044_product-requirement-document_002.md": PRD_002,
    });

    await runApprovePrototype({}, deps);

    const body = capturedPrBodies[0];
    expect(body).toContain("Alpha goal one");
    expect(body).toContain("Beta goal one");
  });

  it("includes PRD titles (Requirement names) in PR body", async () => {
    const { deps, capturedPrBodies } = makeDeps({
      "it_000044_product-requirement-document_001.md": PRD_001,
      "it_000044_product-requirement-document_002.md": PRD_002,
    });

    await runApprovePrototype({}, deps);

    const body = capturedPrBodies[0];
    expect(body).toContain("Feature Alpha");
    expect(body).toContain("Feature Beta");
  });

  it("PRD sections appear in index order (PRD_001 before PRD_002)", async () => {
    const { deps, capturedPrBodies } = makeDeps({
      "it_000044_product-requirement-document_001.md": PRD_001,
      "it_000044_product-requirement-document_002.md": PRD_002,
    });

    await runApprovePrototype({}, deps);

    const body = capturedPrBodies[0];
    const alphaPos = body.indexOf("Feature Alpha");
    const betaPos = body.indexOf("Feature Beta");
    expect(alphaPos).toBeLessThan(betaPos);
  });

  it("includes refactor report path in PR body", async () => {
    const { deps, capturedPrBodies } = makeDeps({
      "it_000044_product-requirement-document_001.md": PRD_001,
      "it_000044_product-requirement-document_002.md": PRD_002,
    });

    await runApprovePrototype({}, deps);

    expect(capturedPrBodies[0]).toContain("refactor-report");
  });

  it("PR body ends with NVST footer", async () => {
    const { deps, capturedPrBodies } = makeDeps({
      "it_000044_product-requirement-document_001.md": PRD_001,
      "it_000044_product-requirement-document_002.md": PRD_002,
    });

    await runApprovePrototype({}, deps);

    expect(capturedPrBodies[0]).toContain(NVST_PR_FOOTER);
  });

  it("PR title is derived from first PRD", async () => {
    const { deps, capturedPrTitles } = makeDeps({
      "it_000044_product-requirement-document_001.md": PRD_001,
      "it_000044_product-requirement-document_002.md": PRD_002,
    });

    await runApprovePrototype({}, deps);

    expect(capturedPrTitles[0]).toContain("Feature Alpha");
  });
});

// ---------------------------------------------------------------------------
// US-008-AC04: gh unavailable — warns and skips PR, CHANGELOG is not corrupted
// ---------------------------------------------------------------------------

describe("US-008-AC04: gh unavailable — warns and skips PR creation", () => {
  it("warns when gh CLI is not available", async () => {
    const warnMessages: string[] = [];
    const { deps } = makeDeps(
      {
        "it_000044_product-requirement-document_001.md": PRD_001,
        "it_000044_product-requirement-document_002.md": PRD_002,
      },
      {
        checkGhAvailableFn: async () => false,
        warnFn: (msg: string) => { warnMessages.push(msg); },
      },
    );

    await runApprovePrototype({}, deps);

    expect(warnMessages.some((m) => m.toLowerCase().includes("gh"))).toBe(true);
  });

  it("skips PR creation but still writes CHANGELOG when gh is unavailable", async () => {
    const { deps, capturedChangelogWrites, capturedPrBodies } = makeDeps(
      {
        "it_000044_product-requirement-document_001.md": PRD_001,
        "it_000044_product-requirement-document_002.md": PRD_002,
      },
      {
        checkGhAvailableFn: async () => false,
      },
    );

    await runApprovePrototype({}, deps);

    // CHANGELOG should still be written
    expect(capturedChangelogWrites).toHaveLength(1);
    // PR should not be created
    expect(capturedPrBodies).toHaveLength(0);
  });

  it("does not throw when gh is unavailable", async () => {
    const { deps } = makeDeps(
      {
        "it_000044_product-requirement-document_001.md": PRD_001,
        "it_000044_product-requirement-document_002.md": PRD_002,
      },
      {
        checkGhAvailableFn: async () => false,
      },
    );

    await expect(runApprovePrototype({}, deps)).resolves.toBeUndefined();
  });
});
