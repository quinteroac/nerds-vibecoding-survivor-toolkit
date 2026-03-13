import { afterEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { State } from "../../scaffold/schemas/tmpl_state";
import type { AgentInvokeOptions } from "../agent";
import { FLOW_REL_DIR } from "../state";
import {
  buildGitOpsConfirmationPrompt,
  promptForGitOperationsConfirmation,
  runApprovePrototype,
} from "./approve-prototype";

function makeExistsForPaths(existing: string[]): (path: string) => Promise<boolean> {
  return async (path: string) => existing.includes(path);
}

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

afterEach(() => {
  process.exitCode = 0;
});

describe("approve prototype command", () => {
  test("registers approve prototype command in CLI dispatch", async () => {
    const source = await readFile(join(process.cwd(), "src", "cli.ts"), "utf8");

    expect(source).toContain('import { runApprovePrototype } from "./commands/approve-prototype";');
    expect(source).toContain('if (subcommand === "prototype") {');
    expect(source).toContain("await runApprovePrototype({ force });");
  });

  describe("guardrail based on audit/refactor artifacts", () => {
    test("US-001-AC01/AC02: resolves audit and refactor paths and fails when neither audit.md nor refactor-report.md exists", async () => {
      const projectRoot = process.cwd();
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
      const projectRoot = process.cwd();
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

    test("US-001-AC04: proceeds when audit.md exists and audit.json does not (nothing to refactor path) and invokes approve-prototype skill", async () => {
      const projectRoot = process.cwd();
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const auditMdPath = join(flowDir, `it_${iteration}_audit.md`);

      const existingPaths = [auditMdPath];
      const prompts: string[] = [];
      const skills: string[] = [];

      await expect(
        runApprovePrototype(
          { force: false },
          {
            readStateFn: async () => makeState({ current_iteration: iteration }),
            existsFn: makeExistsForPaths(existingPaths),
            loadSkillFn: async (_root, skillName) => {
              skills.push(skillName);
              return "# Approve Prototype";
            },
            invokeAgentFn: async (options) => {
              prompts.push(options.prompt);
              return { exitCode: 0, stdout: "", stderr: "" };
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(skills).toEqual(["approve-prototype"]);
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("# Approve Prototype");
      expect(prompts[0]).toContain("### iteration");
      expect(prompts[0]).toContain(iteration);
    });

    test("US-001-AC05: proceeds when refactor-report.md exists (refactor done path) and invokes approve-prototype skill", async () => {
      const projectRoot = process.cwd();
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const refactorReportPath = join(flowDir, `it_${iteration}_refactor-report.md`);

      const existingPaths = [refactorReportPath];
      const prompts: string[] = [];
      const skills: string[] = [];

      await expect(
        runApprovePrototype(
          { force: false },
          {
            readStateFn: async () => makeState({ current_iteration: iteration }),
            existsFn: makeExistsForPaths(existingPaths),
            loadSkillFn: async (_root, skillName) => {
              skills.push(skillName);
              return "# Approve Prototype";
            },
            invokeAgentFn: async (options) => {
              prompts.push(options.prompt);
              return { exitCode: 0, stdout: "", stderr: "" };
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(skills).toEqual(["approve-prototype"]);
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("# Approve Prototype");
      expect(prompts[0]).toContain("### iteration");
      expect(prompts[0]).toContain(iteration);
    });

    test("US-001-AC06: guardrail respects --force via assertGuardrail (force bypasses failures) and still invokes approve-prototype skill", async () => {
      const projectRoot = process.cwd();
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const auditJsonPath = join(flowDir, `it_${iteration}_audit.json`);

      const existingPaths = [auditJsonPath];
      const prompts: string[] = [];
      const skills: string[] = [];

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
            loadSkillFn: async (_root, skillName) => {
              skills.push(skillName);
              return "# Approve Prototype";
            },
            invokeAgentFn: async (options) => {
              prompts.push(options.prompt);
              return { exitCode: 0, stdout: "", stderr: "" };
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(skills).toEqual(["approve-prototype"]);
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("# Approve Prototype");
      expect(prompts[0]).toContain("### iteration");
      expect(prompts[0]).toContain(iteration);
    });
  });

  describe("US-002: Agent updates context files interactively", () => {
    test("US-002-AC01/AC04: loads approve-prototype skill, builds prompt with iteration, invokes agent with interactive: true and throws on non-zero exit", async () => {
      const projectRoot = process.cwd();
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const refactorReportPath = join(flowDir, `it_${iteration}_refactor-report.md`);

      const existingPaths = [refactorReportPath];
      const calls: AgentInvokeOptions[] = [];
      const skills: string[] = [];

      await expect(
        runApprovePrototype(
          { force: false },
          {
            readStateFn: async () => makeState({ current_iteration: iteration }),
            existsFn: makeExistsForPaths(existingPaths),
            loadSkillFn: async (_root, skillName) => {
              skills.push(skillName);
              return "# Approve Prototype Skill Body";
            },
            invokeAgentFn: async (options) => {
              calls.push(options);
              return { exitCode: 0, stdout: "", stderr: "" };
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(skills).toEqual(["approve-prototype"]);
      expect(calls).toHaveLength(1);
      expect(calls[0].interactive).toBe(true);
      expect(calls[0].prompt).toContain("# Approve Prototype Skill Body");
      expect(calls[0].prompt).toContain("### iteration");
      expect(calls[0].prompt).toContain(iteration);

      await expect(
        runApprovePrototype(
          { force: false },
          {
            readStateFn: async () => makeState({ current_iteration: iteration }),
            existsFn: makeExistsForPaths(existingPaths),
            loadSkillFn: async () => "# Skill",
            invokeAgentFn: async () => ({ exitCode: 1, stdout: "", stderr: "Agent failed" }),
          },
        ),
      ).rejects.toThrow("Agent invocation failed with exit code 1");
    });

    test("US-002-AC02/AC03: SKILL.md instructs reading iteration artifacts, updating context/roadmap, and presenting per-file plan before edits", async () => {
      const skillPath = join(
        process.cwd(),
        ".agents",
        "skills",
        "approve-prototype",
        "SKILL.md",
      );
      const content = await readFile(skillPath, "utf8");

      expect(content).toContain(".agents/flow/it_{iteration}_PRD.json");
      expect(content).toContain("it_{iteration}_refactor-report.md");
      expect(content).toContain("it_{iteration}_progress.json");
      expect(content).toContain(".agents/PROJECT_CONTEXT.md");
      expect(content).toContain("ROADMAP.md");
      expect(content).toContain("AGENTS.md");
      expect(content).toContain("README.md");

      expect(content).toMatch(/Plan and present changes/i);
      expect(content).toMatch(/before editing anything/i);
      expect(content).toMatch(/summary of the current state/i);
      expect(content).toMatch(/summary of the proposed changes/i);
      expect(content).toMatch(/Planned updates/i);

      expect(content).toMatch(/Update `PROJECT_CONTEXT\.md` and `ROADMAP\.md`/i);
      expect(content).toMatch(/Optionally update `AGENTS\.md` and `README\.md` when stale/i);
    });
  });

  describe("US-003: User confirms updates before git operations", () => {
    test("US-003-AC01: builds confirmation prompt listing updated files and including commit/push/PR question", () => {
      const prompt = buildGitOpsConfirmationPrompt(["PROJECT_CONTEXT.md", "ROADMAP.md"]);
      expect(prompt).toBe(
        "The agent updated: PROJECT_CONTEXT.md, ROADMAP.md. Proceed with commit, push, and PR creation? [y/N]",
      );
    });

    test("US-003-AC02: prompt helper treats 'n' or empty input as abort, prints aborted message, and does not set exit code", async () => {
      const messages: string[] = [];
      const writeFn = (msg: string): void => {
        messages.push(msg);
      };

      const files = ["PROJECT_CONTEXT.md", "ROADMAP.md"];

      const resultEmpty = await promptForGitOperationsConfirmation(
        files,
        async () => "",
        writeFn,
        () => true,
      );
      expect(resultEmpty).toBe(false);

      const resultNo = await promptForGitOperationsConfirmation(
        files,
        async () => "n",
        writeFn,
        () => true,
      );
      expect(resultNo).toBe(false);

      expect(messages).toContain(
        "The agent updated: PROJECT_CONTEXT.md, ROADMAP.md. Proceed with commit, push, and PR creation? [y/N]",
      );
      expect(messages).toContain("Aborted. No git operations performed.");
      expect(process.exitCode).toBe(0);
    });

    test("US-003-AC03: when user confirms, prompt helper returns true and does not print aborted message", async () => {
      const messages: string[] = [];
      const writeFn = (msg: string): void => {
        messages.push(msg);
      };

      const files = ["PROJECT_CONTEXT.md", "ROADMAP.md"];

      const resultYes = await promptForGitOperationsConfirmation(
        files,
        async () => "y",
        writeFn,
        () => true,
      );

      expect(resultYes).toBe(true);
      expect(messages).toContain(
        "The agent updated: PROJECT_CONTEXT.md, ROADMAP.md. Proceed with commit, push, and PR creation? [y/N]",
      );
      expect(messages).not.toContain("Aborted. No git operations performed.");
      expect(process.exitCode).toBe(0);
    });

    test("US-003-AC02/AC04: runApprovePrototype logs abort message and exits cleanly when user declines git operations", async () => {
      const projectRoot = process.cwd();
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
            existsFn: async (path: string) => existingPaths.includes(path),
            loadSkillFn: async () => "# Approve Prototype",
            invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
            readChangedFilesFn: async () => ["PROJECT_CONTEXT.md", "ROADMAP.md"],
            promptGitOpsConfirmationFn: async () => false,
            logFn: (msg: string) => {
              logs.push(msg);
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(logs).toContain("Aborted. No git operations performed.");
      expect(process.exitCode).toBe(0);
    });

    test("US-003-AC03: when user confirms, runApprovePrototype returns successfully without logging abort message", async () => {
      const projectRoot = process.cwd();
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
            existsFn: async (path: string) => existingPaths.includes(path),
            loadSkillFn: async () => "# Approve Prototype",
            invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
            readChangedFilesFn: async () => ["PROJECT_CONTEXT.md", "ROADMAP.md"],
            promptGitOpsConfirmationFn: async () => true,
            logFn: (msg: string) => {
              logs.push(msg);
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(logs).not.toContain("Aborted. No git operations performed.");
      expect(process.exitCode).toBe(0);
    });
  });

  describe("US-004: Commit and push the feature branch", () => {
    test("US-004-AC01/AC02: when user confirms, runs gitAddAndCommitFn with expected message and then gitPushFn with current branch", async () => {
      const projectRoot = process.cwd();
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const refactorReportPath = join(flowDir, `it_${iteration}_refactor-report.md`);

      const existingPaths = [refactorReportPath];
      const commits: Array<{ root: string; message: string }> = [];
      const pushes: Array<{ root: string; branch: string }> = [];

      await expect(
        runApprovePrototype(
          { force: false },
          {
            readStateFn: async () => makeState({ current_iteration: iteration }),
            existsFn: async (path: string) => existingPaths.includes(path),
            loadSkillFn: async () => "# Approve Prototype",
            invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
            readChangedFilesFn: async () => ["PROJECT_CONTEXT.md", "ROADMAP.md"],
            promptGitOpsConfirmationFn: async () => true,
            gitAddAndCommitFn: async (root, message) => {
              commits.push({ root, message });
            },
            getCurrentBranchFn: async () => "feature/it_000027",
            gitPushFn: async (root, branch) => {
              pushes.push({ root, branch });
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(commits).toHaveLength(1);
      expect(commits[0].message).toBe("feat: approve iteration 000027 prototype");

      expect(pushes).toHaveLength(1);
      expect(pushes[0].branch).toBe("feature/it_000027");
    });

    test("US-004-AC03: if git push fails, the command throws an error mentioning the branch and underlying reason", async () => {
      const projectRoot = process.cwd();
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const refactorReportPath = join(flowDir, `it_${iteration}_refactor-report.md`);

      const existingPaths = [refactorReportPath];

      await expect(
        runApprovePrototype(
          { force: false },
          {
            readStateFn: async () => makeState({ current_iteration: iteration }),
            existsFn: async (path: string) => existingPaths.includes(path),
            loadSkillFn: async () => "# Approve Prototype",
            invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
            readChangedFilesFn: async () => ["PROJECT_CONTEXT.md", "ROADMAP.md"],
            promptGitOpsConfirmationFn: async () => true,
            gitAddAndCommitFn: async () => {},
            getCurrentBranchFn: async () => "feature/it_000027",
            gitPushFn: async () => {
              throw new Error(
                "Git push failed for branch 'feature/it_000027': remote rejected non-fast-forward",
              );
            },
          },
        ),
      ).rejects.toThrow(
        "Git push failed for branch 'feature/it_000027': remote rejected non-fast-forward",
      );
    });
  });

  describe("US-005: Create a GitHub Pull Request", () => {
    test("US-005-AC01/AC02: after successful push, checks gh availability and creates PR with expected title/body when available", async () => {
      const projectRoot = process.cwd();
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const refactorReportPath = join(flowDir, `it_${iteration}_refactor-report.md`);
      const prdPath = join(flowDir, `it_${iteration}_PRD.json`);

      const existingPaths = [refactorReportPath, prdPath];

      let checkGhCalled = false;
      let prTitle = "";
      let prBody = "";

      await expect(
        runApprovePrototype(
          { force: false },
          {
            readStateFn: async () => makeState({ current_iteration: iteration }),
            existsFn: async (path: string) => existingPaths.includes(path),
            loadSkillFn: async () => "# Approve Prototype",
            invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
            readChangedFilesFn: async () => ["PROJECT_CONTEXT.md"],
            promptGitOpsConfirmationFn: async () => true,
            gitAddAndCommitFn: async () => {},
            getCurrentBranchFn: async () => "feature/it_000027",
            gitPushFn: async () => {},
            checkGhAvailableFn: async () => {
              checkGhCalled = true;
              return true;
            },
            createPullRequestFn: async (_projectRoot, title, body) => {
              prTitle = title;
              prBody = body;
              return { exitCode: 0, stderr: "" };
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(checkGhCalled).toBe(true);
      expect(prTitle).toBe(
        "feat: it_000027 — Guardrail — command only runs after audit is done and refactor path is resolved",
      );
      expect(prBody).toBe(
        "Guardrail — command only runs after audit is done and refactor path is resolved\n\nRefactor report: .agents/flow/it_000027_refactor-report.md",
      );
    });

    test("US-005-AC03: when gh is unavailable, prints warning and skips PR creation without error", async () => {
      const projectRoot = process.cwd();
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const refactorReportPath = join(flowDir, `it_${iteration}_refactor-report.md`);

      const existingPaths = [refactorReportPath];
      const warnings: string[] = [];
      let createPrCalled = false;

      await expect(
        runApprovePrototype(
          { force: false },
          {
            readStateFn: async () => makeState({ current_iteration: iteration }),
            existsFn: async (path: string) => existingPaths.includes(path),
            loadSkillFn: async () => "# Approve Prototype",
            invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
            readChangedFilesFn: async () => ["PROJECT_CONTEXT.md"],
            promptGitOpsConfirmationFn: async () => true,
            gitAddAndCommitFn: async () => {},
            getCurrentBranchFn: async () => "feature/it_000027",
            gitPushFn: async () => {},
            checkGhAvailableFn: async () => false,
            createPullRequestFn: async () => {
              createPrCalled = true;
              return { exitCode: 0, stderr: "" };
            },
            warnFn: (msg: string) => {
              warnings.push(msg);
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(createPrCalled).toBe(false);
      expect(warnings).toContain(
        "GitHub CLI (gh) not found. Skipping PR creation. Push was successful.",
      );
    });

    test("US-005-AC04: gh pr create failures are reported as non-fatal warnings containing stderr", async () => {
      const projectRoot = process.cwd();
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const refactorReportPath = join(flowDir, `it_${iteration}_refactor-report.md`);

      const existingPaths = [refactorReportPath];
      const warnings: string[] = [];

      await expect(
        runApprovePrototype(
          { force: false },
          {
            readStateFn: async () => makeState({ current_iteration: iteration }),
            existsFn: async (path: string) => existingPaths.includes(path),
            loadSkillFn: async () => "# Approve Prototype",
            invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
            readChangedFilesFn: async () => ["PROJECT_CONTEXT.md"],
            promptGitOpsConfirmationFn: async () => true,
            gitAddAndCommitFn: async () => {},
            getCurrentBranchFn: async () => "feature/it_000027",
            gitPushFn: async () => {},
            checkGhAvailableFn: async () => true,
            createPullRequestFn: async () => ({
              exitCode: 1,
              stderr: "validation failed: already has an open pull request",
            }),
            warnFn: (msg: string) => {
              warnings.push(msg);
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("gh pr create failed (non-fatal)");
      expect(warnings[0]).toContain("validation failed: already has an open pull request");
    });
  });

  describe("US-006: Mark prototype_approval as completed in state.json", () => {
    test("US-006-AC01/AC02: after successful git and PR flow, writes state with prototype_approval.status=completed and file=null", async () => {
      const projectRoot = process.cwd();
      const iteration = "000027";
      const flowDir = join(projectRoot, FLOW_REL_DIR);
      const refactorReportPath = join(flowDir, `it_${iteration}_refactor-report.md`);
      const prdPath = join(flowDir, `it_${iteration}_PRD.json`);

      const existingPaths = [refactorReportPath, prdPath];
      let writtenState: State | null = null;
      let writtenRoot: string | null = null;

      await expect(
        runApprovePrototype(
          { force: false },
          {
            readStateFn: async () => makeState({ current_iteration: iteration }),
            existsFn: async (path: string) => existingPaths.includes(path),
            loadSkillFn: async () => "# Approve Prototype",
            invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
            readChangedFilesFn: async () => ["PROJECT_CONTEXT.md"],
            promptGitOpsConfirmationFn: async () => true,
            gitAddAndCommitFn: async () => {},
            getCurrentBranchFn: async () => "feature/it_000027",
            gitPushFn: async () => {},
            checkGhAvailableFn: async () => true,
            createPullRequestFn: async () => ({ exitCode: 0, stderr: "" }),
            writeStateFn: async (root, state) => {
              writtenRoot = root;
              writtenState = state;
            },
          },
        ),
      ).resolves.toBeUndefined();

      expect(writtenRoot as unknown as string).toBe(projectRoot);
      expect(writtenState).not.toBeNull();
      const finalState = writtenState as unknown as State;
      expect(finalState.phases.prototype.prototype_approval).toEqual({
        status: "completed",
        file: null,
      });
      expect(typeof finalState.last_updated).toBe("string");
      expect(finalState.updated_by).toBe("nvst:approve-prototype");
    });
  });
});
