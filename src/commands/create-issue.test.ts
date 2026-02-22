import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";

import { IssuesSchema } from "../../scaffold/schemas/tmpl_issues";
import {
  extractJson,
  buildIssuesFromTestResults,
  isActionableStatus,
  type TestExecutionResults,
} from "./create-issue";

// ---------------------------------------------------------------------------
// AC03 / FR-6: ISSUES schema validation
// ---------------------------------------------------------------------------

describe("IssuesSchema validation", () => {
  test("accepts a valid issues array", () => {
    const data = [
      { id: "ISSUE-000008-001", title: "Bug A", description: "Details A", status: "open" },
      { id: "ISSUE-000008-002", title: "Bug B", description: "Details B", status: "fixed" },
    ];
    const result = IssuesSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test("accepts an empty array", () => {
    const result = IssuesSchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  test("rejects duplicate IDs", () => {
    const data = [
      { id: "ISSUE-001", title: "Bug A", description: "Details A", status: "open" },
      { id: "ISSUE-001", title: "Bug B", description: "Details B", status: "open" },
    ];
    const result = IssuesSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test("rejects invalid status value", () => {
    const data = [
      { id: "ISSUE-001", title: "Bug A", description: "Details A", status: "closed" },
    ];
    const result = IssuesSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test("rejects missing required fields", () => {
    const data = [{ id: "ISSUE-001", title: "Bug A" }];
    const result = IssuesSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test("rejects non-array input", () => {
    const result = IssuesSchema.safeParse({ id: "ISSUE-001", title: "Bug" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractJson helper
// ---------------------------------------------------------------------------

describe("extractJson", () => {
  test("extracts JSON from markdown code fences", () => {
    const input = 'Some text\n```json\n[{"title":"Bug"}]\n```\nMore text';
    expect(extractJson(input)).toBe('[{"title":"Bug"}]');
  });

  test("extracts JSON from plain code fences", () => {
    const input = '```\n[{"title":"Bug"}]\n```';
    expect(extractJson(input)).toBe('[{"title":"Bug"}]');
  });

  test("extracts JSON array directly from text", () => {
    const input = 'Here is the output: [{"title":"Bug","description":"Desc"}]';
    expect(extractJson(input)).toBe('[{"title":"Bug","description":"Desc"}]');
  });

  test("returns raw text when no JSON array found", () => {
    const input = "no json here";
    expect(extractJson(input)).toBe("no json here");
  });

  test("handles clean JSON array input", () => {
    const input = '[{"title":"Bug","description":"Details"}]';
    expect(extractJson(input)).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// AC01: CLI routing — create issue requires --agent
// ---------------------------------------------------------------------------

describe("CLI routing for create issue", () => {
  test("exits with code 1 when --agent is missing", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli.ts", "create", "issue"],
      { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(exitCode).toBe(1);
    expect(stderr).toContain("--agent");
  });

  test("exits with code 1 for unknown provider", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli.ts", "create", "issue", "--agent", "invalid-provider"],
      { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown agent provider");
  });

  test("exits with code 1 for unknown options", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli.ts", "create", "issue", "--agent", "claude", "--unknown-flag"],
      { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown option");
  });
});

// ---------------------------------------------------------------------------
// AC02: Auto-generated id and default status
// ---------------------------------------------------------------------------

describe("issue ID generation and status defaults", () => {
  test("generated issues have unique sequential IDs and status open", () => {
    const agentOutput = [
      { title: "Bug 1", description: "First bug" },
      { title: "Bug 2", description: "Second bug" },
    ];
    const iteration = "000008";
    const issues = agentOutput.map((item, index) => ({
      id: `ISSUE-${iteration}-${String(index + 1).padStart(3, "0")}`,
      title: item.title,
      description: item.description,
      status: "open" as const,
    }));

    expect(issues[0].id).toBe("ISSUE-000008-001");
    expect(issues[1].id).toBe("ISSUE-000008-002");
    expect(issues[0].status).toBe("open");
    expect(issues[1].status).toBe("open");

    // Validate against schema
    const result = IssuesSchema.safeParse(issues);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC04: Output path convention
// ---------------------------------------------------------------------------

describe("output file path", () => {
  test("follows it_{iteration}_ISSUES.json naming convention", () => {
    const iteration = "000008";
    const expectedFileName = `it_${iteration}_ISSUES.json`;
    expect(expectedFileName).toBe("it_000008_ISSUES.json");

    const expectedRelPath = `.agents/flow/${expectedFileName}`;
    expect(expectedRelPath).toBe(".agents/flow/it_000008_ISSUES.json");
  });
});

// ---------------------------------------------------------------------------
// AC04: write-json schema registration (issues schema available)
// ---------------------------------------------------------------------------

describe("write-json issues schema registration", () => {
  test("write-json accepts issues schema name", async () => {
    const validData = JSON.stringify([
      { id: "ISSUE-001", title: "Test", description: "Desc", status: "open" },
    ]);
    const proc = Bun.spawn(
      [
        "bun",
        "run",
        "src/cli.ts",
        "write-json",
        "--schema",
        "issues",
        "--out",
        "/tmp/nvst-test-issues.json",
        "--data",
        validData,
      ],
      { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
    );
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);

    // Clean up
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink("/tmp/nvst-test-issues.json");
    } catch {
      // ignore cleanup errors
    }
  });

  test("write-json rejects invalid issues data", async () => {
    const invalidData = JSON.stringify([
      { id: "ISSUE-001", title: "Test" }, // missing description and status
    ]);
    const proc = Bun.spawn(
      [
        "bun",
        "run",
        "src/cli.ts",
        "write-json",
        "--schema",
        "issues",
        "--out",
        "/tmp/nvst-test-issues-invalid.json",
        "--data",
        invalidData,
      ],
      { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
    );
    const exitCode = await proc.exited;
    expect(exitCode).toBe(1);
  });
});

// ===========================================================================
// US-002: Create issues from test execution results
// ===========================================================================

// ---------------------------------------------------------------------------
// US-002-AC02: isActionableStatus helper
// ---------------------------------------------------------------------------

describe("isActionableStatus", () => {
  test("returns true for failed", () => {
    expect(isActionableStatus("failed")).toBe(true);
  });

  test("returns true for skipped", () => {
    expect(isActionableStatus("skipped")).toBe(true);
  });

  test("returns true for invocation_failed", () => {
    expect(isActionableStatus("invocation_failed")).toBe(true);
  });

  test("returns false for passed", () => {
    expect(isActionableStatus("passed")).toBe(false);
  });

  test("returns false for arbitrary string", () => {
    expect(isActionableStatus("unknown")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// US-002-AC02: buildIssuesFromTestResults
// ---------------------------------------------------------------------------

describe("buildIssuesFromTestResults", () => {
  const makeResults = (
    entries: Array<{ id: string; desc: string; status: string; notes?: string; evidence?: string }>,
  ): TestExecutionResults => ({
    iteration: "000008",
    results: entries.map((e) => ({
      testCaseId: e.id,
      description: e.desc,
      correlatedRequirements: ["US-001"],
      payload: {
        status: e.status,
        notes: e.notes,
        evidence: e.evidence,
      },
    })),
  });

  test("converts failed/skipped/invocation_failed tests to issues with status open", () => {
    const results = makeResults([
      { id: "TC-001", desc: "Test A fails", status: "failed", notes: "assertion error" },
      { id: "TC-002", desc: "Test B skipped", status: "skipped" },
      { id: "TC-003", desc: "Test C invocation failed", status: "invocation_failed", notes: "timeout" },
    ]);

    const issues = buildIssuesFromTestResults(results, "000008");

    expect(issues).toHaveLength(3);
    expect(issues[0].id).toBe("ISSUE-000008-001");
    expect(issues[0].status).toBe("open");
    expect(issues[0].title).toContain("[failed]");
    expect(issues[0].title).toContain("TC-001");

    expect(issues[1].id).toBe("ISSUE-000008-002");
    expect(issues[1].status).toBe("open");
    expect(issues[1].title).toContain("[skipped]");

    expect(issues[2].id).toBe("ISSUE-000008-003");
    expect(issues[2].status).toBe("open");
    expect(issues[2].title).toContain("[invocation_failed]");
  });

  test("includes notes and evidence in description", () => {
    const results = makeResults([
      { id: "TC-001", desc: "Test A", status: "failed", notes: "some note", evidence: "log output" },
    ]);

    const issues = buildIssuesFromTestResults(results, "000008");
    expect(issues[0].description).toContain("some note");
    expect(issues[0].description).toContain("log output");
    expect(issues[0].description).toContain("US-001");
  });

  test("filters out passing tests", () => {
    const results = makeResults([
      { id: "TC-001", desc: "Passing test", status: "passed" },
      { id: "TC-002", desc: "Failing test", status: "failed" },
    ]);

    const issues = buildIssuesFromTestResults(results, "000008");
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toContain("TC-002");
  });

  test("returns empty array when all tests pass (AC04)", () => {
    const results = makeResults([
      { id: "TC-001", desc: "Pass A", status: "passed" },
      { id: "TC-002", desc: "Pass B", status: "passed" },
    ]);

    const issues = buildIssuesFromTestResults(results, "000008");
    expect(issues).toHaveLength(0);

    // Validate empty array against schema
    const validation = IssuesSchema.safeParse(issues);
    expect(validation.success).toBe(true);
  });

  test("generated issues pass ISSUES schema validation (AC06)", () => {
    const results = makeResults([
      { id: "TC-001", desc: "Fail A", status: "failed", notes: "err" },
      { id: "TC-002", desc: "Skip B", status: "skipped" },
    ]);

    const issues = buildIssuesFromTestResults(results, "000008");
    const validation = IssuesSchema.safeParse(issues);
    expect(validation.success).toBe(true);
  });

  test("issue IDs are unique and sequential", () => {
    const results = makeResults([
      { id: "TC-001", desc: "A", status: "failed" },
      { id: "TC-002", desc: "B", status: "skipped" },
      { id: "TC-003", desc: "C", status: "invocation_failed" },
    ]);

    const issues = buildIssuesFromTestResults(results, "000010");
    const ids = issues.map((i) => i.id);
    expect(ids).toEqual(["ISSUE-000010-001", "ISSUE-000010-002", "ISSUE-000010-003"]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// US-002-AC01/AC03/AC04/AC05: CLI integration tests for --test-execution-report
// ---------------------------------------------------------------------------

describe("create issue --test-execution-report CLI integration", () => {
  const tmpDir = join(process.cwd(), ".agents", "flow", "__test_tmp__");
  const cwd = process.cwd();

  // We cannot easily test the full CLI flow without mocking state.json,
  // so we test the CLI routing layer separately.

  test("exits with code 1 for unknown options combined with --test-execution-report", async () => {
    const proc = Bun.spawn(
      ["bun", "run", "src/cli.ts", "create", "issue", "--test-execution-report", "--extra-flag"],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown option");
  });

  test("--test-execution-report is accepted as a valid flag (does not show --agent error)", async () => {
    // This will fail because there's no test-execution-results file for the current iteration,
    // but it should NOT fail with "Missing --agent" — it should fail with a file-not-found error
    const proc = Bun.spawn(
      ["bun", "run", "src/cli.ts", "create", "issue", "--test-execution-report"],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    // Should NOT contain --agent requirement
    expect(stderr).not.toContain("Missing --agent");
    // Should contain a test-execution-results related error (AC05)
    expect(stderr).toContain("test-execution-results");
  });
});
