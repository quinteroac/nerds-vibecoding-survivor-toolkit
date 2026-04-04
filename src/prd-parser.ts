import type { Prd } from "./schemas/tmpl_prd";

/**
 * Parses a Markdown PRD into a structured Prd object.
 *
 * Expected sections:
 *   ## Goals          — bullet list of goal strings
 *   ### US-xxx: Title — user story blocks with **Acceptance Criteria:** sub-list
 *   ## Functional Requirements — bullet list of "FR-x: description"
 */
export function parsePrd(markdown: string): Prd {
  const goals: string[] = [];
  const userStories: Prd["userStories"] = [];
  const functionalRequirements: Prd["functionalRequirements"] = [];

  const lines = markdown.split("\n");

  let currentSection: "goals" | "user-stories" | "functional-requirements" | null = null;
  let currentStory: Prd["userStories"][number] | null = null;
  let inAcceptanceCriteria = false;

  for (const line of lines) {
    const trimmed = line.trim();

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
      if (currentStory) {
        userStories.push(currentStory);
        currentStory = null;
      }
      currentSection = "functional-requirements";
      inAcceptanceCriteria = false;
      continue;
    }
    if (/^## /.test(trimmed)) {
      if (currentStory) {
        userStories.push(currentStory);
        currentStory = null;
      }
      currentSection = null;
      inAcceptanceCriteria = false;
      continue;
    }

    if (currentSection === "goals") {
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        goals.push(bulletMatch[1].trim());
      }
      continue;
    }

    if (currentSection === "user-stories") {
      const storyMatch = trimmed.match(/^###\s+(US-\d+):\s+(.+)$/);
      if (storyMatch) {
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

      if (/\*\*Acceptance Criteria:\*\*/i.test(trimmed)) {
        inAcceptanceCriteria = true;
        continue;
      }

      if (inAcceptanceCriteria) {
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

      if (trimmed.length > 0) {
        const descLine = trimmed.replace(/\*\*/g, "");
        if (currentStory.description) {
          currentStory.description += " " + descLine;
        } else {
          currentStory.description = descLine;
        }
      }
      continue;
    }

    if (currentSection === "functional-requirements") {
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

  if (currentStory) {
    userStories.push(currentStory);
  }

  return { goals, userStories, functionalRequirements };
}
