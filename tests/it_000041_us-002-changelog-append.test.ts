/**
 * Tests for US-002: Append iteration goals to CHANGELOG.md on approve-prototype
 * Iteration: 000041
 */
import { describe, it, expect } from "bun:test";
import {
  extractGoalBullets,
  buildChangelogEntry,
  insertChangelogEntry,
  CHANGELOG_HEADER,
  runApprovePrototype,
} from "../src/commands/approve-prototype";
import type { State } from "../schemas/tmpl_state";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeState(iteration = "000041"): State {
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

const SAMPLE_PRD_WITH_GOALS = `# Requirement: Test Feature

## Context
Some context.

## Goals
- First goal item
- Second goal item
- Third goal item

## User Stories
### US-001
Some story.
`;

const SAMPLE_PRD_NO_GOALS = `# Requirement: Test Feature

## Context
Some context.

## User Stories
### US-001
Some story.
`;

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
    getCurrentBranchFn: async () => "feature/it_000041-test",
    gitPushFn: async () => {},
    checkGhAvailableFn: async () => false,
    createPullRequestFn: async () => ({ exitCode: 0, stderr: "" }),
    writeStateFn: async () => {},
    readPrdMarkdownFn: async () => SAMPLE_PRD_WITH_GOALS,
    readChangelogFn: async () => null,
    writeChangelogFn: async () => {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure function: extractGoalBullets
// ---------------------------------------------------------------------------

describe("extractGoalBullets", () => {
  it("extracts bullet lines from a Goals section that includes the heading", () => {
    const section = "## Goals\n- First goal\n- Second goal\n- Third goal";
    expect(extractGoalBullets(section)).toEqual([
      "- First goal",
      "- Second goal",
      "- Third goal",
    ]);
  });

  it("returns empty array when there are no bullet lines", () => {
    const section = "## Goals\nSome prose with no bullets.";
    expect(extractGoalBullets(section)).toEqual([]);
  });

  it("trims leading/trailing whitespace from lines before matching", () => {
    const section = "## Goals\n  - Indented bullet\n- Normal bullet";
    expect(extractGoalBullets(section)).toEqual(["- Indented bullet", "- Normal bullet"]);
  });

  it("skips the heading line itself", () => {
    const section = "## Goals\n- Only bullet";
    const result = extractGoalBullets(section);
    expect(result).not.toContain("## Goals");
    expect(result).toEqual(["- Only bullet"]);
  });
});

// ---------------------------------------------------------------------------
// Pure function: buildChangelogEntry
// ---------------------------------------------------------------------------

describe("buildChangelogEntry", () => {
  it("formats entry with iteration tag, date, ### Added heading, and bullets", () => {
    const entry = buildChangelogEntry("000041", "2026-04-01", [
      "- First goal",
      "- Second goal",
    ]);
    expect(entry).toBe(
      "## [000041] - 2026-04-01\n\n### Added\n- First goal\n- Second goal",
    );
  });

  it("includes all bullet items", () => {
    const entry = buildChangelogEntry("000041", "2026-04-01", [
      "- Goal A",
      "- Goal B",
      "- Goal C",
    ]);
    expect(entry).toContain("- Goal A");
    expect(entry).toContain("- Goal B");
    expect(entry).toContain("- Goal C");
  });
});

// ---------------------------------------------------------------------------
// Pure function: insertChangelogEntry
// ---------------------------------------------------------------------------

describe("insertChangelogEntry", () => {
  it("appends entry after header when no existing entries exist", () => {
    const existing = `# Changelog\n\nAll notable changes.\n\n---`;
    const entry = "## [000041] - 2026-04-01\n\n### Added\n- Goal A";
    const result = insertChangelogEntry(existing, entry);
    expect(result).toContain("## [000041] - 2026-04-01");
    expect(result.indexOf("## [000041]")).toBeGreaterThan(result.indexOf("---"));
  });

  it("inserts new entry before an existing entry (most recent first)", () => {
    const existing = `# Changelog\n\nAll notable changes.\n\n---\n\n## [000040] - 2026-03-31\n\n### Added\n- Old goal\n`;
    const entry = "## [000041] - 2026-04-01\n\n### Added\n- New goal";
    const result = insertChangelogEntry(existing, entry);
    const idx000041 = result.indexOf("## [000041]");
    const idx000040 = result.indexOf("## [000040]");
    expect(idx000041).toBeLessThan(idx000040);
  });

  it("normalises CRLF line endings in existing content", () => {
    const existing = "# Changelog\r\n\r\nAll notable changes.\r\n\r\n---";
    const entry = "## [000041] - 2026-04-01\n\n### Added\n- Goal A";
    const result = insertChangelogEntry(existing, entry);
    expect(result).not.toContain("\r\n");
    expect(result).toContain("## [000041]");
  });
});

// ---------------------------------------------------------------------------
// US-002-AC01: reads PRD file for current iteration
// ---------------------------------------------------------------------------

describe("US-002-AC01: reads PRD file for current iteration", () => {
  it("calls readPrdMarkdownFn with a path containing the iteration and correct filename", async () => {
    const calls: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async (p: string) => {
        calls.push(p);
        return SAMPLE_PRD_WITH_GOALS;
      },
    });

    await runApprovePrototype({}, deps);

    expect(
      calls.some(
        (p) =>
          p.includes("000041") && p.includes("product-requirement-document.md"),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// US-002-AC02: Goals bullets used as changelog entries
// ---------------------------------------------------------------------------

describe("US-002-AC02: Goals bullets used as changelog entries", () => {
  it("writes changelog content containing all goal bullets from the PRD", async () => {
    const written: Array<{ path: string; content: string }> = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => SAMPLE_PRD_WITH_GOALS,
      readChangelogFn: async () => null,
      writeChangelogFn: async (path: string, content: string) => {
        written.push({ path, content });
      },
    });

    await runApprovePrototype({}, deps);

    expect(written.length).toBeGreaterThan(0);
    const content = written[0].content;
    expect(content).toContain("- First goal item");
    expect(content).toContain("- Second goal item");
    expect(content).toContain("- Third goal item");
  });
});

// ---------------------------------------------------------------------------
// US-002-AC03: correct Keep a Changelog format
// ---------------------------------------------------------------------------

describe("US-002-AC03: correct Keep a Changelog format", () => {
  it("writes a ## [iteration] - YYYY-MM-DD heading", async () => {
    const written: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => SAMPLE_PRD_WITH_GOALS,
      readChangelogFn: async () => null,
      writeChangelogFn: async (_: string, content: string) => {
        written.push(content);
      },
    });

    await runApprovePrototype({}, deps);

    expect(written[0]).toMatch(/## \[000041\] - \d{4}-\d{2}-\d{2}/);
  });

  it("includes a ### Added section", async () => {
    const written: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => SAMPLE_PRD_WITH_GOALS,
      readChangelogFn: async () => null,
      writeChangelogFn: async (_: string, content: string) => {
        written.push(content);
      },
    });

    await runApprovePrototype({}, deps);

    expect(written[0]).toContain("### Added");
  });

  it("new entry appears before any existing ## [...] entries", async () => {
    const existing = `# Changelog\n\nAll notable changes.\n\n---\n\n## [000040] - 2026-03-31\n\n### Added\n- Old entry\n`;
    const written: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => SAMPLE_PRD_WITH_GOALS,
      readChangelogFn: async () => existing,
      writeChangelogFn: async (_: string, content: string) => {
        written.push(content);
      },
    });

    await runApprovePrototype({}, deps);

    const result = written[0];
    expect(result.indexOf("## [000041]")).toBeLessThan(result.indexOf("## [000040]"));
  });

  it("creates CHANGELOG.md with header when file does not exist", async () => {
    const written: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => SAMPLE_PRD_WITH_GOALS,
      readChangelogFn: async () => null,
      writeChangelogFn: async (_: string, content: string) => {
        written.push(content);
      },
    });

    await runApprovePrototype({}, deps);

    expect(written[0]).toContain("# Changelog");
    expect(written[0]).toContain("Keep a Changelog");
  });

  it("writes to CHANGELOG.md (path ends with CHANGELOG.md)", async () => {
    const paths: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => SAMPLE_PRD_WITH_GOALS,
      readChangelogFn: async () => null,
      writeChangelogFn: async (path: string) => {
        paths.push(path);
      },
    });

    await runApprovePrototype({}, deps);

    expect(paths.some((p) => p.endsWith("CHANGELOG.md"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// US-002 edge cases: missing PRD, missing Goals section, empty bullets
// ---------------------------------------------------------------------------

describe("US-002 edge cases", () => {
  it("skips changelog update and warns when PRD is not found", async () => {
    const warnings: string[] = [];
    const written: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => null,
      warnFn: (msg: string) => warnings.push(msg),
      writeChangelogFn: async (_: string, content: string) => written.push(content),
    });

    await runApprovePrototype({}, deps);

    expect(written.length).toBe(0);
    expect(warnings.some((w) => w.toLowerCase().includes("prd") || w.toLowerCase().includes("skipping"))).toBe(true);
  });

  it("skips changelog update and warns when PRD has no ## Goals section", async () => {
    const warnings: string[] = [];
    const written: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => SAMPLE_PRD_NO_GOALS,
      warnFn: (msg: string) => warnings.push(msg),
      writeChangelogFn: async (_: string, content: string) => written.push(content),
    });

    await runApprovePrototype({}, deps);

    expect(written.length).toBe(0);
    expect(warnings.some((w) => w.toLowerCase().includes("goals") || w.toLowerCase().includes("skipping"))).toBe(true);
  });

  it("skips changelog update and warns when Goals section has no bullet items", async () => {
    const prdNoBullets = `# Requirement: Test\n\n## Goals\nSome prose without bullets.\n`;
    const warnings: string[] = [];
    const written: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => prdNoBullets,
      warnFn: (msg: string) => warnings.push(msg),
      writeChangelogFn: async (_: string, content: string) => written.push(content),
    });

    await runApprovePrototype({}, deps);

    expect(written.length).toBe(0);
    expect(warnings.some((w) => w.toLowerCase().includes("skipping"))).toBe(true);
  });

  it("continues with the rest of approve-prototype even when changelog is skipped", async () => {
    const commits: string[] = [];
    const deps = makeDeps({
      readPrdMarkdownFn: async () => null,
      gitAddAndCommitFn: async (_: string, msg: string) => {
        commits.push(msg);
      },
    });

    await runApprovePrototype({}, deps);

    // commit should still happen despite skipped changelog
    expect(commits.length).toBeGreaterThan(0);
  });
});
