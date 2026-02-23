import { runExecuteManualFix, type ExecuteManualFixDeps, type IssueOutcomeAction } from "../src/commands/execute-manual-fix";
import { type AgentInvokeOptions, type AgentResult } from "../src/agent";
import { join } from "node:path";
import { writeFile, readFile } from "node:fs/promises";
import type { State } from "../scaffold/schemas/tmpl_state";

async function main() {
  console.log("Starting UX simulation for Manual Fix Workflow...");

  const mockIssues = [
    {
      id: "ISSUE-100",
      title: "Broken Login Button",
      description: "The login button does nothing when clicked.",
      status: "manual-fix"
    },
    {
      id: "ISSUE-101",
      title: "Typo in header",
      description: "It says 'Heder' instead of 'Header'.",
      status: "manual-fix"
    }
  ];

  const mockState: State = {
    current_iteration: "000010",
    completed_iterations: [],
    status: "in_progress",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const deps: Partial<ExecuteManualFixDeps> = {
    existsFn: async (path: string) => true,
    readFileFn: async (path: string) => {
      // Mocking readFileFn for issues
      if (path.includes("ISSUES.json")) {
        return JSON.stringify(mockIssues);
      }
      return "";
    },
    readStateFn: async (root: string) => mockState,
    writeFileFn: async (path: string, content: string) => {
      console.log(`[File Write] ${path}:\n${content.substring(0, 100)}...`);
    },
    logFn: (msg: string) => console.log(`[Log] ${msg}`),
    promptProceedFn: async (q: string) => {
      console.log(`[Prompt] ${q} -> (Auto-answering Yes)`);
      return true;
    },
    invokeAgentFn: async (opts: AgentInvokeOptions) => {
      console.log(`[Agent Session Start] Prompt length: ${opts.prompt.length}`);
      console.log(`[Agent Session] (Simulated conversation with ${opts.provider}...)`);
      console.log(`[Agent Session End]`);
      return { exitCode: 0, stdout: "", stderr: "" };
    },
    promptIssueOutcomeFn: async (q: string) => {
        console.log(`[Prompt] ${q} -> (Auto-answering Fixed)`);
        return "fixed" as IssueOutcomeAction;
    }
  };

  try {
    await runExecuteManualFix({ provider: "gemini" }, deps);
    console.log("Simulation complete.");
  } catch (e) {
    console.error("Simulation failed:", e);
  }
}

main();
