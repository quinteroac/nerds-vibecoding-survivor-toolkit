import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";

const PROJECT_ROOT = join(import.meta.dir, "..");
const NOTICE_PATH = join(PROJECT_ROOT, "NOTICE.md");
const README_PATH = join(PROJECT_ROOT, "README.md");

const IMPECCABLE_NOTICE_VERBATIM = `# Notice

Impeccable
Copyright 2025 Paul Bakaus

## Anthropic frontend-design Skill

The \`frontend-design\` skill in this project builds on Anthropic's original frontend-design skill.

**Original work:** https://github.com/anthropics/skills/tree/main/skills/frontend-design
**Original license:** Apache License 2.0
**Copyright:** 2025 Anthropic, PBC

This project extends the original with:
- 7 domain-specific reference files (typography, color-and-contrast, spatial-design, motion-design, interaction-design, responsive-design, ux-writing)
- 17 steering commands
- Expanded patterns and anti-patterns`;

describe("NOTICE.md and README acknowledgements — US-005", () => {
  it("AC01: NOTICE.md exists with NVST notice, Third-Party section, and Impeccable attribution details", async () => {
    const notice = await readFile(NOTICE_PATH, "utf8");

    expect(notice.length).toBeGreaterThan(0);
    expect(notice).toContain("Nerds Vibecoding Survivor Toolkit (NVST)");
    expect(notice).toContain("Copyright 2026 Victor Quintero");
    expect(notice).toContain("## Third-Party Notices");
    expect(notice).toContain("### Impeccable");
    expect(notice).toContain("- Project: Impeccable");
    expect(notice).toContain("- Author: pbakaus");
    expect(notice).toContain("- Source: https://github.com/pbakaus/impeccable");
    expect(notice).toContain("- License: Apache 2.0");
    expect(notice).toContain(IMPECCABLE_NOTICE_VERBATIM);
  });

  it("AC02: README includes acknowledgements crediting Impeccable with Apache 2.0 note", async () => {
    const readme = await readFile(README_PATH, "utf8");

    expect(readme).toContain("## Acknowledgements");
    expect(readme).toContain("[Impeccable](https://github.com/pbakaus/impeccable)");
    expect(readme).toContain("Apache 2.0");
  });

  it("AC03: NOTICE.md keeps NVST copyright block and adds third-party content without replacement", async () => {
    const notice = await readFile(NOTICE_PATH, "utf8");

    const nvstCopyrightIndex = notice.indexOf("Copyright 2026 Victor Quintero");
    const thirdPartyHeaderIndex = notice.indexOf("## Third-Party Notices");
    const impeccableCopyrightIndex = notice.indexOf("Copyright 2025 Paul Bakaus");

    expect(nvstCopyrightIndex).toBeGreaterThan(-1);
    expect(thirdPartyHeaderIndex).toBeGreaterThan(-1);
    expect(impeccableCopyrightIndex).toBeGreaterThan(-1);
    expect(thirdPartyHeaderIndex).toBeGreaterThan(nvstCopyrightIndex);
    expect(impeccableCopyrightIndex).toBeGreaterThan(thirdPartyHeaderIndex);
  });
});
