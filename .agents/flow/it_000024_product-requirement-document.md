# Requirement: Interactive Open Questions during Define Requirement Phase

## Context
Currently, during the "define requirement" phase, the agent might leave unresolved "Open Questions" in the Product Requirement Document (PRD). This feature aims to make the "define requirement" phase interactive by proactively asking the user to clarify any open questions unprompted at the end of the PRD generation, providing suggestions, and addressing them one by one.

## Goals
- Make the "define requirement" phase interactive for resolving open questions.
- Address any generated open questions one-by-one with the user.
- Provide the user with recommendations/suggestions for answering the open questions.

## User Stories

### US-001: Agent asks open questions interactively
**As a** user, **I want** the agent to ask me any open questions interactively at the end of the PRD generation **so that** no requirements are left ambiguous.

**Acceptance Criteria:**
- [ ] At the end of the PRD generation, the agent detects if there are any open questions.
- [ ] The agent asks the open questions to the user one by one.
- [ ] The agent waits for the user's answer before proceeding to the next question.
- [ ] Typecheck / lint passes

### US-002: Agent provides suggestions for open questions
**As a** user, **I want** the agent to provide suggestions or recommendations when asking open questions **so that** I have helpful context to provide an answer.

**Acceptance Criteria:**
- [ ] When an open question is asked, the agent includes valid suggestions or inferred options for the user to choose from.
- [ ] Typecheck / lint passes

### US-003: Sync agent skills definition
**As an** internal process, **I want** the skill modifications to happen in both `.agents/` and `scaffold/` directories **so that** standard project context remains consistent across instantiated and scaffolded projects.

**Acceptance Criteria:**
- [ ] The prompt/skill files updated (e.g., `create-pr-document.md`) are modified identically in both `.agents/skills/` and `scaffold/agents/skills/`.
- [ ] Typecheck / lint passes

## Functional Requirements
- FR-1: Update the skill prompt for PRD generation (`create-pr-document` or similar) to instruct the agent to append an interactive Q&A session if "Open Questions" exist after drafting the PRD.
- FR-2: Ensure the skill modifications are mirrored between the working directory (`.agents/skills/`) and the scaffold directory (`scaffold/agents/skills/`).
- FR-3: The interactive workflow must process questions sequentially, one at a time, not parallel.

## Non-Goals (Out of Scope)
- Modifying the core execution engine of `nvst define requirement` (the TS code remains the same, changes should ideally be in the prompt or skill markdown, unless impossible).
- Web UI implementation (this is a CLI tool).

## Open Questions
- None.
