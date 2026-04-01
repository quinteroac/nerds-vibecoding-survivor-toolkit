/**
 * Tests for US-001: Slug extracted from PRD title
 * Iteration: 000039
 */
import { describe, it, expect } from "bun:test";
import { toKebabSlug, extractPrdTitle } from "../src/commands/create-prototype";

// ---------------------------------------------------------------------------
// US-001-AC02 / US-001-AC03: toKebabSlug
// ---------------------------------------------------------------------------

describe("toKebabSlug — US-001-AC02/AC03", () => {
  it("lowercases the title", () => {
    expect(toKebabSlug("Hello World")).toBe("hello-world");
  });

  it("replaces non-alphanumeric characters with hyphens", () => {
    expect(toKebabSlug("My Feature: The Next Step!")).toBe("my-feature-the-next-step");
  });

  it("collapses consecutive hyphens into one", () => {
    expect(toKebabSlug("foo  --  bar")).toBe("foo-bar");
  });

  it("trims leading hyphens", () => {
    expect(toKebabSlug("  Hello")).toBe("hello");
  });

  it("trims trailing hyphens", () => {
    expect(toKebabSlug("Hello  ")).toBe("hello");
  });

  it("handles a realistic PRD title", () => {
    expect(toKebabSlug("Meaningful Branch Names for Create Prototype")).toBe(
      "meaningful-branch-names-for-create-prototype",
    );
  });

  it("returns empty string for a blank title", () => {
    expect(toKebabSlug("")).toBe("");
  });

  it("returns empty string for a title with only special characters", () => {
    expect(toKebabSlug("---!!!---")).toBe("");
  });

  it("preserves numbers", () => {
    expect(toKebabSlug("Feature 42 Beta")).toBe("feature-42-beta");
  });
});

// ---------------------------------------------------------------------------
// US-001-AC01: extractPrdTitle
// ---------------------------------------------------------------------------

describe("extractPrdTitle — US-001-AC01", () => {
  it("extracts the text after '# Requirement:' on the first matching line", () => {
    const content = "# Requirement: My Cool Feature\n\nSome body text.";
    expect(extractPrdTitle(content)).toBe("My Cool Feature");
  });

  it("handles extra whitespace around the title", () => {
    const content = "#  Requirement:   Spaced Out Title  \n\nBody";
    expect(extractPrdTitle(content)).toBe("Spaced Out Title");
  });

  it("returns null when no matching line exists", () => {
    const content = "# Some Other Heading\n\nNo requirement here.";
    expect(extractPrdTitle(content)).toBeNull();
  });

  it("matches the first occurrence when multiple headings exist", () => {
    const content = "# Requirement: First Title\n# Requirement: Second Title\n";
    expect(extractPrdTitle(content)).toBe("First Title");
  });

  it("works with the actual it_000039 PRD markdown snippet", () => {
    const content =
      "# Requirement: Meaningful Branch Names for Create Prototype\n\n## Context\n";
    expect(extractPrdTitle(content)).toBe(
      "Meaningful Branch Names for Create Prototype",
    );
  });
});
