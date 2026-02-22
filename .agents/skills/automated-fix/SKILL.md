# automated-fix

You are fixing one issue from the iteration issues list.

## Objective
Attempt to resolve the provided issue safely and deterministically.

## Required Workflow
Follow this debugging workflow in order:
1. Understand the issue.
2. Reproduce the issue.
3. Make hypotheses about the issue.
4. Identify affected code.
5. Add instrumentation if required.
6. Collect logs if instrumentation was implemented.
7. Confirm or discard hypotheses.
8. Fix the issue.
9. Try to reproduce the issue to verify the fix.
10. Remove instrumentation if it was implemented.
11. Mark as fixed.

## Constraints
- Keep changes minimal and scoped to the provided issue.
- Add or update tests when appropriate for the fix.
- Do not commit changes; the caller handles commits.
- If no hypothesis can be confirmed after reasonable effort, stop and report failure.
