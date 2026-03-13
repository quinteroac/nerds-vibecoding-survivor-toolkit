import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { State } from "../../scaffold/schemas/tmpl_state";
import { FLOW_REL_DIR } from "../state";
import { runApprovePrototype } from "./approve-prototype";

function makeState(overrides?: Partial<State>): State {
  return {
    current_iteration: "000027",
    current_phase: "prototype",
    flow_guardrail: "strict",
    phases: {
      define: {
        requirement_definition: { status: "completed", file: "it_000027_requirement.md" },
        prd_generation: { status: "completed", file: "it_000027_product-requirement-document.md" },
      },
      prototype: {
        project_context: { status: "completed", file: "it_000027_project-context.md" },
        test_plan: { status: "completed", file: "it_000027_test-plan.md" },
        tp_generation: { status: "completed", file: "it_000027_test-plan-generation.md" },
        prototype_build: { status: "completed", file: "it_000027_prototype-build.md" },
        test_execution: { status: "completed", file: "it_000027_test-execution.md" },
        prototype_approved: false,
        prototype_audit: { status: "completed", file: "it_000027_audit.md" },
        prototype_refactor: { status: "pending", file: null },
      },
      refactor: {
        evaluation_report: { status: "pending", file: null },
        refactor_plan: { status: "pending", file: null },
        refactor_execution: { status: "pending", file: null },
        changelog: { status: "pending", file: null },
      },
    },
    last_updated: "2026-03-12T00:00:00.000Z",
    updated_by: "test",
    ...overrides,
  } as State;
}

describe("approve prototype command", () => {
  test("registers approve prototype command in CLI dispatch", async () => {
    const source = await readFile(join(process.cwd(), "src", "cli.ts"), "utf8");

    expect(source).toContain('import { runApprovePrototype } from "./commands/approve-prototype";');
    expect(source).toContain('if (subcommand === "prototype") {');
    expect(source).toContain("await runApprovePrototype({ force });");
  });

  describe("guardrail based on audit/refactor artifacts", () => {
    function makeExistsForPaths(existing: string[]): (path: string) => Promise<boolean> {
      return async (path: string) => existing.includes(path);
    }

    test("US-001-AC01/AC02: resolves audit and refactor paths and fails when neither audit.md nor refactor-report.md exists", async () => {
      const projectRoot = "/project";
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const auditMdPath = join(flowDir, `it_${iteration}_audit.md`);
      const refactorReportPath = join(flowDir, `it_${iteration}_refactor-report.md`);

      const existingPaths: string[] = [];

      await expect(
        runApprovePrototype(
          { force: false },
          {
            readStateFn: async () => makeState({ current_iteration: iteration }),
            existsFn: makeExistsForPaths(existingPaths),
            logFn: () => {},
          },
        ),
      ).rejects.toThrow(
        "Cannot approve prototype: audit prototype has not been run for this iteration.",
      );

      // Sanity-check that test constructed the same paths the implementation expects
      expect(auditMdPath).toContain(join(FLOW_REL_DIR, `it_${iteration}_audit.md`));
      expect(refactorReportPath).toContain(
        join(FLOW_REL_DIR, `it_${iteration}_refactor-report.md`),
      );
    });

    test("US-001-AC03: fails with refactor-specific message when audit.json exists but refactor-report.md does not", async () => {
      const projectRoot = "/project";
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const auditJsonPath = join(flowDir, `it_${iteration}_audit.json`);

      const existingPaths = [auditJsonPath];

      await expect(
        runApprovePrototype(
          { force: false },
          {
            readStateFn: async () => makeState({ current_iteration: iteration }),
            existsFn: makeExistsForPaths(existingPaths),
            logFn: () => {},
          },
        ),
      ).rejects.toThrow(
        "Cannot approve prototype: a refactor plan exists but refactor prototype has not been run. Run `nvst refactor prototype` first.",
      );
    });

    test("US-001-AC04: proceeds when audit.md exists and audit.json does not (nothing to refactor path)", async () => {
      const projectRoot = "/project";
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const auditMdPath = join(flowDir, `it_${iteration}_audit.md`);

      const existingPaths = [auditMdPath];
      const logs: string[] = [];

      await expect(
        runApprovePrototype(
          { force: false },
          {
            readStateFn: async () => makeState({ current_iteration: iteration }),
            existsFn: makeExistsForPaths(existingPaths),
            logFn: (msg) => {
              logs.push(msg);
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(logs).toEqual(["nvst approve prototype is not implemented yet."]);
    });

    test("US-001-AC05: proceeds when refactor-report.md exists (refactor done path)", async () => {
      const projectRoot = "/project";
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const refactorReportPath = join(flowDir, `it_${iteration}_refactor-report.md`);

      const existingPaths = [refactorReportPath];
      const logs: string[] = [];

      await expect(
        runApprovePrototype(
          { force: false },
          {
            readStateFn: async () => makeState({ current_iteration: iteration }),
            existsFn: makeExistsForPaths(existingPaths),
            logFn: (msg) => {
              logs.push(msg);
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(logs).toEqual(["nvst approve prototype is not implemented yet."]);
    });

    test("US-001-AC06: guardrail respects --force via assertGuardrail (force bypasses failures)", async () => {
      const projectRoot = "/project";
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const auditJsonPath = join(flowDir, `it_${iteration}_audit.json`);

      const existingPaths = [auditJsonPath];
      const logs: string[] = [];

      await expect(
        runApprovePrototype(
          { force: true },
          {
            readStateFn: async () =>
              makeState({
                current_iteration: iteration,
                flow_guardrail: "relaxed",
              }),
            existsFn: makeExistsForPaths(existingPaths),
            logFn: (msg) => {
              logs.push(msg);
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(logs).toEqual(["nvst approve prototype is not implemented yet."]);
    });
  });
});
