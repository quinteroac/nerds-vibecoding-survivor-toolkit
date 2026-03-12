/**
 * Parses a PRD markdown string and returns the list of open questions
 * from the "## Open Questions" section (bullet or numbered list items).
 * Used to detect open questions for interactive resolution.
 */

const OPEN_QUESTIONS_HEADING = /^##\s+Open\s+Questions\s*$/im;
const LIST_ITEM = /^\s*[-*]\s+(.+)$|^\s*\d+\.\s+(.+)$/;
const OTHER_HEADING = /^##\s+/m;

/**
 * Extracts open question lines from the "## Open Questions" section of PRD markdown.
 * Returns an array of trimmed question strings (one per list item). Empty array if
 * the section is absent or has no list items.
 */
export function parseOpenQuestionsFromPrd(prdMarkdown: string): string[] {
  const match = prdMarkdown.match(OPEN_QUESTIONS_HEADING);
  if (!match || match.index === undefined) return [];

  const afterHeading = prdMarkdown.slice(match.index + match[0].length);
  const nextSection = afterHeading.match(OTHER_HEADING);
  const sectionEnd = nextSection?.index ?? afterHeading.length;
  const section = afterHeading.slice(0, sectionEnd);

  const questions: string[] = [];
  for (const line of section.split(/\r?\n/)) {
    const itemMatch = line.match(LIST_ITEM);
    if (itemMatch) {
      const text = (itemMatch[1] ?? itemMatch[2] ?? "").trim();
      if (text.length > 0) questions.push(text);
    }
  }
  return questions;
}
