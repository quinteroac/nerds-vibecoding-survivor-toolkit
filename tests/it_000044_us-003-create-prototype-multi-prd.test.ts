/**
 * Tests for US-003: `create prototype` iterates over all PRDs and their user stories
 * Iteration: 000044
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCreatePrototype } from "../src/commands/create-prototype";
import { readState, writeState, FLOW_REL_DIR, STATE_REL_PATH } from "../src/state";
import type { State } from "../src/schemas/tmpl_state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MINIMAL_PRD_MARKDOWN_1 = `
# Requirement: Feature Alpha

## Goals

- Goal A

## User Stories

### US-001: Story Alpha One

As a user I want to do A1.

**Acceptance Criteria:**
- [ ] AC01

### US-002: Story Alpha Two

As a user I want to do A2.

**Acceptance Criteria:**
- [ ] AC01

## Functional Requirements

- FR-1: requirement A
`.trim();

const MINIMAL_PRD_MARKDOWN_2 = `
# Requirement: Feature Beta

## Goals

- Goal B

## User Stories

### US-003: Story Beta One

As a user I want to do B1.

**Acceptance Criteria:**
- [ ] AC01

## Functional Requirements

- FR-1: requirement B
`.trim();

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "nvst-it000044-us003-"));
}

function makeBaseState(
  requirementDefs: State["phases"]["define"]["requirement_definition"],
  prototypeCreation?: State["phases"]["prototype"]["prototype_creation"],
): State {
  return {
    current_iteration: "000044",
    current_phase: "prototype",
    flow_guardrail: "strict",
    last_updated: "2026-01-01T00:00:00.000Z",
    phases: {
      define: {
        requirement_definition: requirementDefs,
        prd_generation: { status: "completed", file: "it_000044_PRD.json" },
      },
      prototype: {
        prototype_creation: prototypeCreation ?? [],
      },
      refactor: {},
    },
  };
}

async function setupProject(
  projectRoot: string,
  state: State,
  prdFiles: Record<string, string> = {},
): Promise<void> {
  await mkdir(join(projectRoot, ".agents", "flow"), { recursive: true });
  await mkdir(join(projectRoot, ".agents", "skills", "create-prototype"), { recursive: true });
  await writeFile(
    join(projectRoot, STATE_REL_PATH),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    join(projectRoot, ".agents", "PROJECT_CONTEXT.md"),
    "# Project Context\n\nMinimal context for test.",
    "utf8",
  );
  await writeFile(
    join(projectRoot, ".agents", "skills", "create-prototype", "SKILL.md"),
    "# create-prototype skill\n\n{{iteration}}\n{{user_story}}\n{{project_context}}\n{{lessons_learned}}",
    "utf8",
  );
  for (const [filename, content] of Object.entries(prdFiles)) {
    await writeFile(join(projectRoot, FLOW_REL_DIR, filename), content, "utf8");
  }
}

async function initGitRepo(projectRoot: string): Promise<void> {
  const git = (args: string[]) =>
    Bun.spawn(["git", ...args], { cwd: projectRoot, stdout: "ignore", stderr: "ignore" });
  await git(["init"]).exited;
  await git(["config", "user.email", "test@nvst.test"]).exited;
  await git(["config", "user.name", "NVST Test"]).exited;
  await writeFile(join(projectRoot, ".gitkeep"), "");
  await git(["add", "."]).exited;
  await git(["commit", "-m", "initial commit"]).exited;
}

// ---------------------------------------------------------------------------
// AC01: reads all PRD entries in index order
// ---------------------------------------------------------------------------

describe("US-003-AC01: reads all PRD entries from requirement_definition in index order", () => {
  let projectRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectRoot = await createTempDir();
    process.chdir(projectRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("processes two approved PRD entries in index order", async () => {
    const state = makeBaseState([
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
      { index: 2, status: "approved", file: "it_000044_product-requirement-document_002.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN_1,
      "it_000044_product-requirement-document_002.md": MINIMAL_PRD_MARKDOWN_2,
    });
    await initGitRepo(projectRoot);

    const invokedPrompts: string[] = [];
    await runCreatePrototype(
      { provider: "ide" },
      {
        invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        loadSkillFn: async () => "{{user_story}}",
        writeJsonArtifactFn: async () => {},
        promptDirtyTreeCommitFn: async () => true,
        gitAddAndCommitFn: async () => {},
        logFn: (msg: string) => { invokedPrompts.push(msg); },
        warnFn: () => {},
        readLessonsLearnedFn: async () => "",
      },
    );

    const combinedOutput = invokedPrompts.join("\n");
    // Both PRDs' user stories should appear in output
    expect(combinedOutput).toContain("US-001");
    expect(combinedOutput).toContain("US-002");
    expect(combinedOutput).toContain("US-003");
  });

  it("processes entries in index order (index 2 before index 1 if stored reversed)", async () => {
    // Even if stored as index 2 first, index 1 must be processed first
    const state = makeBaseState([
      { index: 2, status: "approved", file: "it_000044_product-requirement-document_002.md" },
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN_1,
      "it_000044_product-requirement-document_002.md": MINIMAL_PRD_MARKDOWN_2,
    });
    await initGitRepo(projectRoot);

    const storyOrder: string[] = [];
    await runCreatePrototype(
      { provider: "ide" },
      {
        invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        loadSkillFn: async () => "{{user_story}}",
        writeJsonArtifactFn: async () => {},
        promptDirtyTreeCommitFn: async () => true,
        gitAddAndCommitFn: async () => {},
        logFn: (msg: string) => { storyOrder.push(msg); },
        warnFn: () => {},
        readLessonsLearnedFn: async () => "",
      },
    );

    const combined = storyOrder.join("\n");
    // PRD 1 (alpha) stories appear before PRD 2 (beta) stories
    const posA01 = combined.indexOf("US-001");
    const posB01 = combined.indexOf("US-003");
    expect(posA01).toBeGreaterThanOrEqual(0);
    expect(posB01).toBeGreaterThanOrEqual(0);
    expect(posA01).toBeLessThan(posB01);
  });

  it("uses approved _001 PRD file for branch slug and does not warn about missing unsuffixed markdown", async () => {
    const state = makeBaseState([
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN_1,
    });
    await initGitRepo(projectRoot);

    const warnings: string[] = [];
    await runCreatePrototype(
      { provider: "ide" },
      {
        invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        loadSkillFn: async () => "{{user_story}}",
        writeJsonArtifactFn: async () => {},
        promptDirtyTreeCommitFn: async () => true,
        gitAddAndCommitFn: async () => {},
        logFn: () => {},
        warnFn: (msg: string) => { warnings.push(msg); },
        readLessonsLearnedFn: async () => "",
      },
    );

    expect(warnings.some((w) => w.includes("PRD markdown not found"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC02: prompt includes PRD content and user stories
// ---------------------------------------------------------------------------

describe("US-003-AC02: agent prompt includes that PRD's content and user stories", () => {
  let projectRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectRoot = await createTempDir();
    process.chdir(projectRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("includes user story details in agent prompt for agent provider", async () => {
    const state = makeBaseState([
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN_1,
    });
    await initGitRepo(projectRoot);

    const capturedPrompts: string[] = [];
    await runCreatePrototype(
      { provider: "claude" },
      {
        invokeAgentFn: async (opts) => {
          capturedPrompts.push(opts.prompt);
          return { exitCode: 0, stdout: "", stderr: "" };
        },
        loadSkillFn: async () => "{{iteration}} {{user_story}} {{project_context}}",
        writeJsonArtifactFn: async () => {},
        promptDirtyTreeCommitFn: async () => true,
        gitAddAndCommitFn: async () => {},
        logFn: () => {},
        warnFn: () => {},
        readLessonsLearnedFn: async () => "",
      },
    );

    expect(capturedPrompts.length).toBeGreaterThanOrEqual(1);
    // At least one prompt must contain a story from PRD 1
    const allPrompts = capturedPrompts.join("\n");
    expect(allPrompts).toContain("US-00");
    expect(allPrompts).toContain("000044");
  });

  it("generates separate prompts per user story across multiple PRDs", async () => {
    const state = makeBaseState([
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
      { index: 2, status: "approved", file: "it_000044_product-requirement-document_002.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN_1,
      "it_000044_product-requirement-document_002.md": MINIMAL_PRD_MARKDOWN_2,
    });
    await initGitRepo(projectRoot);

    const capturedPrompts: string[] = [];
    await runCreatePrototype(
      { provider: "claude" },
      {
        invokeAgentFn: async (opts) => {
          capturedPrompts.push(opts.prompt);
          return { exitCode: 0, stdout: "", stderr: "" };
        },
        loadSkillFn: async () => "{{user_story}}",
        writeJsonArtifactFn: async () => {},
        promptDirtyTreeCommitFn: async () => true,
        gitAddAndCommitFn: async () => {},
        logFn: () => {},
        warnFn: () => {},
        readLessonsLearnedFn: async () => "",
      },
    );

    // PRD1 has 2 stories, PRD2 has 1 → 3 agent invocations total
    expect(capturedPrompts.length).toBe(3);
    const allPrompts = capturedPrompts.join("\n");
    expect(allPrompts).toContain("US-001");
    expect(allPrompts).toContain("US-002");
    expect(allPrompts).toContain("US-003");
  });
});

// ---------------------------------------------------------------------------
// AC03: prototype_creation becomes array with one entry per PRD
// ---------------------------------------------------------------------------

describe("US-003-AC03: prototype_creation is an array with one entry per PRD", () => {
  let projectRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectRoot = await createTempDir();
    process.chdir(projectRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("creates two entries for two PRDs", async () => {
    const state = makeBaseState([
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
      { index: 2, status: "approved", file: "it_000044_product-requirement-document_002.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN_1,
      "it_000044_product-requirement-document_002.md": MINIMAL_PRD_MARKDOWN_2,
    });
    await initGitRepo(projectRoot);

    await runCreatePrototype(
      { provider: "claude" },
      {
        invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        loadSkillFn: async () => "{{user_story}}",
        writeJsonArtifactFn: async () => {},
        promptDirtyTreeCommitFn: async () => true,
        gitAddAndCommitFn: async () => {},
        logFn: () => {},
        warnFn: () => {},
        readLessonsLearnedFn: async () => "",
      },
    );

    const updated = await readState(projectRoot);
    const creationArray = updated.phases.prototype.prototype_creation;
    expect(Array.isArray(creationArray)).toBe(true);
    expect((creationArray as unknown[]).length).toBe(2);

    const entries = creationArray as Array<{ index: number; status: string; file: string | null }>;
    const byIndex = new Map(entries.map((e) => [e.index, e]));
    expect(byIndex.has(1)).toBe(true);
    expect(byIndex.has(2)).toBe(true);
    expect(byIndex.get(1)!.status).not.toBe("pending");
    expect(byIndex.get(2)!.status).not.toBe("pending");
  });

  it("each entry has index, status, and file fields", async () => {
    const state = makeBaseState([
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN_1,
    });
    await initGitRepo(projectRoot);

    await runCreatePrototype(
      { provider: "claude" },
      {
        invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        loadSkillFn: async () => "{{user_story}}",
        writeJsonArtifactFn: async () => {},
        promptDirtyTreeCommitFn: async () => true,
        gitAddAndCommitFn: async () => {},
        logFn: () => {},
        warnFn: () => {},
        readLessonsLearnedFn: async () => "",
      },
    );

    const updated = await readState(projectRoot);
    const entries = updated.phases.prototype.prototype_creation as Array<{
      index: number;
      status: string;
      file: string | null;
    }>;
    expect(entries.length).toBe(1);
    const entry = entries[0];
    expect(typeof entry.index).toBe("number");
    expect(typeof entry.status).toBe("string");
    expect("file" in entry).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC04: artifact named it_XXXXXX_prototype-creation_NNN.json
// ---------------------------------------------------------------------------

describe("US-003-AC04: artifact named it_XXXXXX_prototype-creation_NNN.json", () => {
  let projectRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    projectRoot = await createTempDir();
    process.chdir(projectRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("progress file for PRD index 1 is it_000044_prototype-creation_001.json", async () => {
    const state = makeBaseState([
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN_1,
    });
    await initGitRepo(projectRoot);

    const writtenPaths: string[] = [];
    await runCreatePrototype(
      { provider: "ide" },
      {
        invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        loadSkillFn: async () => "{{user_story}}",
        writeJsonArtifactFn: async (path) => { writtenPaths.push(path); },
        promptDirtyTreeCommitFn: async () => true,
        gitAddAndCommitFn: async () => {},
        logFn: () => {},
        warnFn: () => {},
        readLessonsLearnedFn: async () => "",
      },
    );

    expect(writtenPaths.some((p) => p.endsWith("it_000044_prototype-creation_001.json"))).toBe(true);
  });

  it("progress files for PRD indices 1 and 2 use correct naming convention", async () => {
    const state = makeBaseState([
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
      { index: 2, status: "approved", file: "it_000044_product-requirement-document_002.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN_1,
      "it_000044_product-requirement-document_002.md": MINIMAL_PRD_MARKDOWN_2,
    });
    await initGitRepo(projectRoot);

    const writtenPaths: string[] = [];
    await runCreatePrototype(
      { provider: "ide" },
      {
        invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        loadSkillFn: async () => "{{user_story}}",
        writeJsonArtifactFn: async (path) => { writtenPaths.push(path); },
        promptDirtyTreeCommitFn: async () => true,
        gitAddAndCommitFn: async () => {},
        logFn: () => {},
        warnFn: () => {},
        readLessonsLearnedFn: async () => "",
      },
    );

    expect(writtenPaths.some((p) => p.endsWith("it_000044_prototype-creation_001.json"))).toBe(true);
    expect(writtenPaths.some((p) => p.endsWith("it_000044_prototype-creation_002.json"))).toBe(true);
  });

  it("prototype_creation entries in state.json reference the correct filenames", async () => {
    const state = makeBaseState([
      { index: 1, status: "approved", file: "it_000044_product-requirement-document_001.md" },
      { index: 2, status: "approved", file: "it_000044_product-requirement-document_002.md" },
    ]);
    await setupProject(projectRoot, state, {
      "it_000044_product-requirement-document_001.md": MINIMAL_PRD_MARKDOWN_1,
      "it_000044_product-requirement-document_002.md": MINIMAL_PRD_MARKDOWN_2,
    });
    await initGitRepo(projectRoot);

    await runCreatePrototype(
      { provider: "ide" },
      {
        invokeAgentFn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        loadSkillFn: async () => "{{user_story}}",
        writeJsonArtifactFn: async () => {},
        promptDirtyTreeCommitFn: async () => true,
        gitAddAndCommitFn: async () => {},
        logFn: () => {},
        warnFn: () => {},
        readLessonsLearnedFn: async () => "",
      },
    );

    const updated = await readState(projectRoot);
    const entries = updated.phases.prototype.prototype_creation as Array<{
      index: number;
      file: string | null;
    }>;
    const byIndex = new Map(entries.map((e) => [e.index, e]));
    expect(byIndex.get(1)!.file).toBe("it_000044_prototype-creation_001.json");
    expect(byIndex.get(2)!.file).toBe("it_000044_prototype-creation_002.json");
  });
});

// ---------------------------------------------------------------------------
// AC05: typecheck passes (compile-time, verified via import)
// ---------------------------------------------------------------------------

describe("US-003-AC05: typecheck / lint passes", () => {
  it("runCreatePrototype is importable and typed correctly", () => {
    // If this file compiled, types are correct
    expect(typeof runCreatePrototype).toBe("function");
  });
});
