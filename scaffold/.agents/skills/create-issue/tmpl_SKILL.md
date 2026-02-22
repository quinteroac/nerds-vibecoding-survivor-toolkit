---
name: create-issue
description: "Interactively defines one or more issues with the user. Triggered by: bun nvst create issue --agent <provider>."
user-invocable: true
---

# Create Issue

Define one or more issues interactively with the user and output them as a JSON array.

**Important:** Do NOT fix the issues. Just gather information and produce structured JSON output.

---

## The Job

1. Ask the user what issue(s) they want to create. Gather a `title` and `description` for each issue.
2. Ask clarifying questions one at a time until you have enough detail.
3. Output **only** a valid JSON array to stdout — no markdown fences, no commentary.

---

## Questions Flow

**CRITICAL: Ask ONE question at a time. Wait for the user's answer before asking the next question.**

1. Describe the issue — what is the problem or task?
2. Is there additional context (error messages, affected files, reproduction steps)?
3. Are there more issues to add? If yes, repeat questions 1–2.

---

## Output Format

Output ONLY a raw JSON array. No markdown code fences, no explanation — just the JSON.

Each element must have exactly these fields:

```json
[
  {
    "title": "Short issue title",
    "description": "Detailed description of the issue"
  }
]
```

- `title`: a concise summary (one sentence)
- `description`: detailed explanation including context, reproduction steps, or expected behaviour

The calling system will auto-generate `id` and set `status` to `"open"`. Do NOT include `id` or `status` in your output.

---

## Checklist

Before outputting:

- [ ] Each issue has a clear, specific `title`
- [ ] Each issue has a detailed `description`
- [ ] Output is a valid JSON array with no wrapper or commentary
