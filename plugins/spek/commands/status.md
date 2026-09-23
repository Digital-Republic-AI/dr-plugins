---
description: Shows the dashboard of all SDD features in the project and the current phase of each one
allowed-tools: Read, Glob, Bash(${CLAUDE_PLUGIN_ROOT}/scripts/resolve-next.sh:*)
---

# Status

## Steps

1. List all `.spek/specs/*/state.json` files (`Glob: .spek/specs/*/state.json`).

2. For each one, read the JSON and build a table with the columns:
   `feature | mode | phase | completedTasks/totalTasks | updated`.

3. Order the table by `updated` desc (the most recently touched features first).

   Below the table, add one line per feature whose `state.json` has a `handoff` field, with its
   `status`, `tasks` and `note` -- the record of where the last `/spek:implement` run stopped (a
   batch left `in-progress` by a terminated session, or the tasks that `failed`). Features without
   the field get no line.

4. Run `${CLAUDE_PLUGIN_ROOT}/scripts/resolve-next.sh` with no argument and report its answer for
   the current feature (the most recently updated one that is not yet `verified` or `archived`):
   `next.command` and `next.reason`, e.g. "Next step for `002-payment-gateway`: `/spek:clarify`
   (spec.md has 2 [NEEDS CLARIFICATION] marker(s))". Mention that `/spek:next` runs that step.
   The phase -> next command map lives in the script and in `conventions.md`, section "Navigation";
   never restate it from memory. When `next.command` is `start` (no active feature), say so and
   mention that `/spek:start` opens a new feature.

## Rules

- Read-only command -- it never writes to `state.json` or to any spec artifact.
- If `.spek/specs/` does not exist or is empty, say so and suggest `/spek:start` to get started.
- The `context` field (`greenfield|brownfield`) does not change how a feature is reported: a
  brownfield feature (one that started with `/spek:extract`, currently in phase `extract`) and a
  light-mode feature both render as an ordinary row in the same table, using the same columns and
  the same next-step resolution from the script.
