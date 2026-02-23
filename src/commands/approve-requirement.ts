import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";

import { CLI_PATH } from "../cli-path";
import type { Prd } from "../../scaffold/schemas/tmpl_prd";
import { exists, readState, writeState, FLOW_REL_DIR } from "../state";

// ---------------------------------------------------------------------------
// Markdown PRD parser
// ---------------------------------------------------------------------------

/**
 * Parses the Markdown PRD into a structured object matching PrdSchema.
 *
 * Expected sections:
 *   ## Goals          — bullet list of goal strings
 *   ### US-xxx: Title — user story blocks with **Acceptance Criteria:** sub-list
 *   ## Functional Requirements — bullet list of "FR-x: description"
 */
function parsePrd(markdown: string): Prd {
  const goals: string[] = [];
  const userStories: Prd["userStories"] = [];
  const functionalRequirements: Prd["functionalRequirements"] = [];

  const lines = markdown.split("\n");

  let currentSection: "goals" | "user-stories" | "functional-requirements" | null = null;
  let currentStory: Prd["userStories"][number] | null = null;
  let inAcceptanceCriteria = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers
    if (/^## Goals/i.test(trimmed)) {
      currentSection = "goals";
      currentStory = null;
      inAcceptanceCriteria = false;
      continue;
    }
    if (/^## User Stories/i.test(trimmed)) {
      currentSection = "user-stories";
      currentStory = null;
      inAcceptanceCriteria = false;
      continue;
    }
    if (/^## Functional Requirements/i.test(trimmed)) {
      // Flush any pending user story
      if (currentStory) {
        userStories.push(currentStory);
        currentStory = null;
      }
      currentSection = "functional-requirements";
      inAcceptanceCriteria = false;
      continue;
    }
    // Skip other level-2 sections (e.g. ## Context, ## Non-Goals)
    if (/^## /.test(trimmed)) {
      if (currentStory) {
        userStories.push(currentStory);
        currentStory = null;
      }
      currentSection = null;
      inAcceptanceCriteria = false;
      continue;
    }

    // --- Goals section ---
    if (currentSection === "goals") {
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        goals.push(bulletMatch[1].trim());
      }
      continue;
    }

    // --- User Stories section ---
    if (currentSection === "user-stories") {
      // Detect ### US-xxx: Title
      const storyMatch = trimmed.match(/^###\s+(US-\d+):\s+(.+)$/);
      if (storyMatch) {
        // Flush previous story
        if (currentStory) {
          userStories.push(currentStory);
        }
        currentStory = {
          id: storyMatch[1],
          title: storyMatch[2].trim(),
          description: "",
          acceptanceCriteria: [],
        };
        inAcceptanceCriteria = false;
        continue;
      }

      if (!currentStory) continue;

      // Detect **Acceptance Criteria:**
      if (/\*\*Acceptance Criteria:\*\*/i.test(trimmed)) {
        inAcceptanceCriteria = true;
        continue;
      }

      if (inAcceptanceCriteria) {
        // Acceptance criteria items: - [ ] text or - [x] text
        const acMatch = trimmed.match(/^[-*]\s+\[[ x]?\]\s+(.+)$/i);
        if (acMatch) {
          const acIndex = currentStory.acceptanceCriteria.length + 1;
          currentStory.acceptanceCriteria.push({
            id: `${currentStory.id}-AC${String(acIndex).padStart(2, "0")}`,
            text: acMatch[1].trim(),
          });
        }
        continue;
      }

      // Story description lines (between **As a** ... and **Acceptance Criteria:**)
      if (trimmed.length > 0) {
        // Strip bold markers for cleaner description
        const descLine = trimmed.replace(/\*\*/g, "");
        if (currentStory.description) {
          currentStory.description += " " + descLine;
        } else {
          currentStory.description = descLine;
        }
      }
      continue;
    }

    // --- Functional Requirements section ---
    if (currentSection === "functional-requirements") {
      // Accept both "- FR-1: desc" and "- **FR-1:** desc" (bold id)
      const frMatch = trimmed.match(/^[-*]\s+(?:\*\*)?(FR-\d+)(?:\*\*)?:\s*(.+)$/);
      if (frMatch) {
        functionalRequirements.push({
          id: frMatch[1],
          description: frMatch[2].trim(),
        });
      }
      continue;
    }
  }

  // Flush last pending story
  if (currentStory) {
    userStories.push(currentStory);
  }

  return { goals, userStories, functionalRequirements };
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

export async function runApproveRequirement(): Promise<void> {
  const projectRoot = process.cwd();
  const state = await readState(projectRoot);

  // --- US-001: Validate status ---
  const requirementDefinition = state.phases.define.requirement_definition;
  if (requirementDefinition.status !== "in_progress") {
    throw new Error(
      `Cannot approve requirement from status '${requirementDefinition.status}'. Expected in_progress.`,
    );
  }

  const requirementFile = requirementDefinition.file;
  if (!requirementFile) {
    throw new Error("Cannot approve requirement: define.requirement_definition.file is missing.");
  }

  const requirementPath = join(projectRoot, FLOW_REL_DIR, requirementFile);
  if (!(await exists(requirementPath))) {
    throw new Error(`Cannot approve requirement: file not found at ${requirementPath}`);
  }

  // --- US-002: Parse PRD markdown and generate JSON ---
  const markdown = await readFile(requirementPath, "utf-8");
  const prdData = parsePrd(markdown);
  const prdJsonFileName = `it_${state.current_iteration}_PRD.json`;
  const prdJsonRelPath = join(FLOW_REL_DIR, prdJsonFileName);

  // Invoke write-json CLI to validate and write the PRD JSON
  const prdJsonString = JSON.stringify(prdData);
  const result =
    await $`bun ${CLI_PATH} write-json --schema prd --out ${prdJsonRelPath} --data ${prdJsonString}`
      .cwd(projectRoot)
      .nothrow()
      .quiet();

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    console.error("PRD JSON generation failed. Requirement remains in_progress.");
    if (stderr) {
      console.error(stderr);
    }
    process.exitCode = 1;
    return;
  }

  // --- US-001: Transition status only after successful JSON generation ---
  requirementDefinition.status = "approved";

  // --- US-002: Record PRD generation in state ---
  state.phases.define.prd_generation.status = "completed";
  state.phases.define.prd_generation.file = prdJsonFileName;

  state.last_updated = new Date().toISOString();
  state.updated_by = "nvst:approve-requirement";

  await writeState(projectRoot, state);

  console.log("Requirement approved.");
  console.log(`PRD JSON written to ${prdJsonRelPath}`);
}
