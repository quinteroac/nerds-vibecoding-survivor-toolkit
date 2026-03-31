/**
 * Tests for US-002: Branch created with slug suffix
 * Iteration: 000039
 */
import { describe, it, expect } from "bun:test";
import { buildBranchName } from "../src/commands/create-prototype";

// ---------------------------------------------------------------------------
// US-002-AC01: pattern feature/it_XXXXXX_<slug> with underscore separator
// ---------------------------------------------------------------------------

describe("buildBranchName — US-002-AC01", () => {
  it("uses underscore separator between iteration and slug", () => {
    expect(buildBranchName("000039", "some-feature")).toBe("feature/it_000039_some-feature");
  });

  it("matches the pattern feature/it_XXXXXX_<slug>", () => {
    const result = buildBranchName("000001", "my-feature");
    expect(result).toMatch(/^feature\/it_\d{6}_[a-z0-9-]+$/);
  });

  it("returns branch without slug suffix when slug is empty", () => {
    expect(buildBranchName("000039", "")).toBe("feature/it_000039");
  });

  it("produces correct branch for a realistic PRD title slug", () => {
    // "Meaningful Branch Names for Create Prototype" → toKebabSlug → "meaningful-branch-names-for-create-prototype" (44 chars)
    // prefix = "feature/it_000039_" (18 chars), maxSlugLen = 32
    // slug truncated to "meaningful-branch-names-for-crea" (32 chars) → total = 50
    expect(buildBranchName("000039", "meaningful-branch-names-for-create-prototype")).toBe(
      "feature/it_000039_meaningful-branch-names-for-crea",
    );
  });
});

// ---------------------------------------------------------------------------
// US-002-AC02: total branch name truncated to max 50 characters
// ---------------------------------------------------------------------------

describe("buildBranchName — US-002-AC02", () => {
  it("does not exceed 50 characters", () => {
    const longSlug = "a".repeat(40);
    const result = buildBranchName("000039", longSlug);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("never truncates the feature/it_XXXXXX_ prefix", () => {
    const longSlug = "a".repeat(40);
    const result = buildBranchName("000039", longSlug);
    expect(result.startsWith("feature/it_000039_")).toBe(true);
  });

  it("slug within 32 chars is kept intact (prefix=18 chars)", () => {
    const shortSlug = "short-slug"; // 10 chars, well under 32
    const result = buildBranchName("000039", shortSlug);
    expect(result).toBe("feature/it_000039_short-slug");
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("trims trailing hyphens left by truncation", () => {
    // Construct a slug whose 32nd character is a hyphen
    const tricky = "a".repeat(31) + "-extra";
    const result = buildBranchName("000039", tricky);
    expect(result).not.toMatch(/-$/);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("exact-50-char result is allowed", () => {
    // prefix = "feature/it_000039_" = 18 chars; slug = 32 'a's → total = 50
    const slug = "a".repeat(32);
    const result = buildBranchName("000039", slug);
    expect(result.length).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// US-002-AC03: underscore format only (no old hyphen format)
// ---------------------------------------------------------------------------

describe("buildBranchName — US-002-AC03", () => {
  it("does not produce the old feature/it_XXXXXX-<slug> hyphen format", () => {
    const result = buildBranchName("000039", "some-feature");
    expect(result).not.toMatch(/^feature\/it_\d{6}-/);
  });

  it("the prefix always uses an underscore before the slug", () => {
    const result = buildBranchName("000039", "my-feature");
    expect(result).toBe("feature/it_000039_my-feature");
  });
});
