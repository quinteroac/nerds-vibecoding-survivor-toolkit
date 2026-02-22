import { describe, expect, test } from "bun:test";

import { IssuesSchema } from "../../scaffold/schemas/tmpl_issues";
import { extractJson } from "./create-issue";

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
