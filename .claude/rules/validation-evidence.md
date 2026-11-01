<!-- dr-ai-version: 3.8.1 -->
# Validation Evidence

- Before marking work complete, run the validations the change calls for (type check, lint, the affected tests; the build only when the parent allows it) and say which ones were skipped and why.
- Record every run of lint, type check, tests (unit, integration, E2E), verification build, or CI follow-up through the `dr-validation-evidence` skill, including failed runs.
- A record holds the timestamp with timezone, branch, commit and tree state, environment (OS, runtimes, local or CI), command, working directory, duration, exit code, summary and full output. It never holds environment variable values or unmasked secrets.
- Store records in `.dr_ai/tasks/<task>/evidence/` inside a DR_AI task, and in `.dr_ai/test-reports/` otherwise.
- For interface changes, capture screenshots of each changed screen (initial state, each interaction, final state, failures) into the evidence `screenshots/` folder; subagents get the dev server URL from the parent.
- Report the evidence paths in the final message; never claim a validation passed without its record.
