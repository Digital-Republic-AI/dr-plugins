---
description: Condensed specify+plan+tasks flow in a single interaction, for small-to-medium changes
argument-hint: "<description of the change>"
allowed-tools: Read, Write, Edit, MultiEdit, Glob, Grep, Task, AskUserQuestion, Skill(spek:sdd-templates), Bash(${CLAUDE_PLUGIN_ROOT}/skills/sdd-templates/scripts/scaffold.sh:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/new-feature.sh:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh:*)
disable-model-invocation: true
---

# Quick

Execute the equivalent of `/spek:specify`, `/spek:plan` and `/spek:tasks` in sequence, without pausing
for review between each phase, but presenting at the end a single consolidated summary (spec + plan +
task list) for ONE user confirmation before enabling `/spek:implement`.

## Steps

1. Run the `/spek:specify` logic internally (without intermediate interaction, except the mode
   confirmation below), producing `spec.md`. As in `/spek:specify`, resolve the feature number and
   create the directory by running `${CLAUDE_PLUGIN_ROOT}/scripts/new-feature.sh <slug>` -- never
   compute the number or create the directory yourself. A `light` mode suggestion is confirmed
   with the user via `AskUserQuestion` exactly as in `/spek:specify` (a `normal` estimate proceeds
   without asking) -- skipping phases is a user decision and is never applied silently, even in
   quick mode.

2. If there are `[NEEDS CLARIFICATION]` markers, resolve them by asking objective questions via
   `AskUserQuestion` (do not skip this step even in quick mode -- ambiguity is never assumed).

3. Run the `/spek:plan` logic internally, producing `plan.md`.

4. Run the `/spek:tasks` logic internally, producing `tasks.md`.

5. Present a consolidated summary (user stories, main technical decision, task count per phase) and
   ask whether the user wants to proceed straight to `/spek:implement --all`.

Invoke the `spek:sdd-templates` skill once at the start and create every artifact through its
scaffold script (`scaffold.sh spec|spec-light|plan|tasks <feature-dir>`), filling each one in place
with `Edit`/`MultiEdit` inside `.spek/specs/NNN-slug/`; never write an artifact from a template
reconstructed from memory.

Keep `state.json` updated at each internal phase exactly as the individual commands would, always
through `${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh` (`init`, `set-phase`, `set-mode`,
`sync-tasks`) -- never write or edit `state.json` directly.

## Rules

- `/spek:quick` NEVER skips the resolution of `[NEEDS CLARIFICATION]` -- the only thing it condenses is
  the human review pause between specify/plan/tasks, not the quality of the specification.
- The three artifacts are written in English; the consolidated summary and the questions go in
  the user's language.
- Recommended for medium-complexity features. For trivial changes, `/spek:specify` alone already
  handles it via `light` mode detection.
