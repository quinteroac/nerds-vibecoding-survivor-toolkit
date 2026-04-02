# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [000040] - 2026-04-02

### Added
- Use the PRD markdown title as the PR title.
- Append a footer with a link to the GitHub repository.

## [000041] - 2026-04-02

### Added
- Simplify state management by removing the `history` field from `state.json` and its Zod schema.
- Eliminate the `.agents/flow/archived/` directory and all archive logic.
- Preserve a lightweight, append-only human record of completed iterations in `CHANGELOG.md` (Keep a Changelog format, `### Added` section only).
- Ensure `nvst start-iteration` starts each iteration with a clean `.agents/flow/` directory.

## [000040] - 2026-04-01

### Added
- Use the PRD markdown title as the PR title.
- Populate the PR body with Context and Goals sections.
- Append a footer with a link to the GitHub repository.
