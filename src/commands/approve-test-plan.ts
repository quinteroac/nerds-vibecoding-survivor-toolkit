import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";

import type { TestPlan } from "../../scaffold/schemas/tmpl_test-plan";
import { exists, FLOW_REL_DIR, readState, writeState } from "../state";

interface WriteJsonResult {
  exitCode: number;
  stderr: string;
}

interface ApproveTestPlanDeps {
  existsFn: (path: string) => Promise<boolean>;
  invokeWriteJsonFn: (
    projectRoot: string,
    schemaName: string,
    outPath: string,
    data: string,
  ) => Promise<WriteJsonResult>;
  nowFn: () => Date;
  readFileFn: typeof readFile;
}

const defaultDeps: ApproveTestPlanDeps = {
  existsFn: exists,
  invokeWriteJsonFn: runWriteJsonCommand,
  nowFn: () => new Date(),
  readFileFn: readFile,
};

export function parseTestPlan(markdown: string): TestPlan {
  const scope: string[] = [];
  const automatedTests: string[] = [];
  const exploratoryManualTests: string[] = [];
  const environmentAndData: string[] = [];

  type Section = "scope" | "automatedTests" | "exploratoryManualTests" | "environmentAndData" | null;
  let currentSection: Section = null;

  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();

    if (/^##\s+Scope$/i.test(trimmed)) {
      currentSection = "scope";
      continue;
    }
    if (/^##\s+Automated tests$/i.test(trimmed)) {
      currentSection = "automatedTests";
      continue;
    }
    if (/^##\s+Exploratory\s*\/\s*manual tests$/i.test(trimmed)) {
      currentSection = "exploratoryManualTests";
      continue;
    }
    if (/^##\s+Environment and data$/i.test(trimmed)) {
      currentSection = "environmentAndData";
      continue;
    }
    if (/^##\s+/.test(trimmed)) {
      currentSection = null;
      continue;
    }

    if (!currentSection || trimmed.length === 0 || /^<!--/.test(trimmed)) {
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const value = bulletMatch ? bulletMatch[1].trim() : trimmed;
    if (!value) continue;

    if (currentSection === "scope") scope.push(value);
    if (currentSection === "automatedTests") automatedTests.push(value);
    if (currentSection === "exploratoryManualTests") exploratoryManualTests.push(value);
    if (currentSection === "environmentAndData") environmentAndData.push(value);
  }

  return {
    scope,
    automatedTests,
    exploratoryManualTests,
    environmentAndData,
  };
}

async function runWriteJsonCommand(
  projectRoot: string,
  schemaName: string,
  outPath: string,
  data: string,
): Promise<WriteJsonResult> {
  const result =
    await $`bun run src/cli.ts write-json --schema ${schemaName} --out ${outPath} --data ${data}`
      .cwd(projectRoot)
      .nothrow()
      .quiet();

  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString().trim(),
  };
}

export async function runApproveTestPlan(
  deps: Partial<ApproveTestPlanDeps> = {},
): Promise<void> {
  const projectRoot = process.cwd();
  const state = await readState(projectRoot);
  const mergedDeps: ApproveTestPlanDeps = { ...defaultDeps, ...deps };

  const testPlan = state.phases.prototype.test_plan;
  if (testPlan.status !== "pending_approval") {
    throw new Error(
      `Cannot approve test plan from status '${testPlan.status}'. Expected pending_approval.`,
    );
  }

  const testPlanFile = testPlan.file;
  if (!testPlanFile) {
    throw new Error("Cannot approve test plan: prototype.test_plan.file is missing.");
  }

  const testPlanPath = join(projectRoot, FLOW_REL_DIR, testPlanFile);
  if (!(await mergedDeps.existsFn(testPlanPath))) {
    throw new Error(`Cannot approve test plan: file not found at ${testPlanPath}`);
  }

  const markdown = await mergedDeps.readFileFn(testPlanPath, "utf-8");
  const tpData = parseTestPlan(markdown);
  const tpJsonFileName = `it_${state.current_iteration}_TP.json`;
  const tpJsonRelPath = join(FLOW_REL_DIR, tpJsonFileName);

  const writeResult = await mergedDeps.invokeWriteJsonFn(
    projectRoot,
    "test-plan",
    tpJsonRelPath,
    JSON.stringify(tpData),
  );

  if (writeResult.exitCode !== 0) {
    console.error("Test-plan JSON generation failed. Test plan remains pending_approval.");
    if (writeResult.stderr) {
      console.error(writeResult.stderr);
    }
    process.exitCode = 1;
    return;
  }

  testPlan.status = "created";
  state.phases.prototype.tp_generation.status = "created";
  state.phases.prototype.tp_generation.file = tpJsonFileName;
  state.last_updated = mergedDeps.nowFn().toISOString();
  state.updated_by = "nvst:approve-test-plan";

  await writeState(projectRoot, state);

  console.log("Test plan approved.");
  console.log(`Test-plan JSON written to ${tpJsonRelPath}`);
}
