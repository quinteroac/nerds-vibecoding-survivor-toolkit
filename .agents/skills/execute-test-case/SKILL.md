---
name: execute-test-case
description: "Executes a single approved test case and returns a strict JSON result payload. Invoked by: bun nvst execute test-plan."
user-invocable: false
---

# Execute Test Case

Execute exactly one test case from the approved test plan.

All generated content must be in English.

## Inputs

Use the provided context sections:
- `project_context`: project conventions, runtime, quality checks, and constraints
- `test_case_definition`: one test case object with id, description, mode, and correlated requirements

## Execution Rules

1. Read the full `test_case_definition` before running commands.
2. Follow constraints from `project_context` when selecting commands, environment setup, and verification steps.
3. Execute only what is required for this single test case.
4. Capture concise evidence from command outputs or observed results.
5. Determine outcome:
   - `passed`: acceptance for this test case was satisfied
   - `failed`: acceptance for this test case was not satisfied
   - `skipped`: test case cannot be executed due to a justified blocker

## Output Contract (Mandatory)

Return only JSON with this exact shape:

```json
{
  "status": "passed|failed|skipped",
  "evidence": "string",
  "notes": "string"
}
```

Do not output markdown or additional text outside the JSON object.
