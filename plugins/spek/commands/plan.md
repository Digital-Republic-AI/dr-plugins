---
description: Generates the technical implementation plan from the spec (stack, architecture, project structure)
argument-hint: "[NNN-slug of the feature, or empty to use the most recent feature]"
allowed-tools: Read, Glob, Grep, Bash(find:*), Bash(ls:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh:*)
---

# Plan

## Steps

1. Resolve the target feature (the "current feature" rule of `conventions.md`, section
   "Navigation"): if `$ARGUMENTS` was provided, use it as the slug; otherwise, find the most recently
   updated feature in `state.json` that is not yet `verified` or `archived`
   (`Glob: .spek/specs/*/state.json`, ordered by `updated` desc).

2. Check the phase prerequisites before continuing (redundant with the `PreToolUse` hook, but
   validated here as well to give immediate feedback in natural language):
   - `.spek/specs/NNN-slug/spec.md` must exist.
   - The spec must not contain pending `[NEEDS CLARIFICATION]` markers -- if any exist, stop and
     recommend running `/spek:clarify` first.
   - Check the `mode` field in `state.json`: if the feature is `"light"`, refuse to run unless
     the user explicitly asks to promote the feature to normal mode (in that case, run
     `${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh .spek/specs/NNN-slug set-mode normal` and continue
     normally from the existing `spec.md`).

3. Gather technical context from the repository: read `.spek/constitution.md` (if it exists), inspect
   `package.json`/`pyproject.toml`/`go.mod`/etc. at the project root to infer the existing stack, and
   run a light directory-structure scan (`Glob: src/**`, `Glob: app/**`) so as not to propose a
   project structure incompatible with the existing one.

4. Delegate the writing of `.spek/specs/NNN-slug/plan.md` to the `spek:plan-architect` subagent,
   invoking it ONCE. The subagent scaffolds the file through its preloaded `sdd-templates` skill,
   fills it in place, and returns only a short completion notice -- the path(s) written and any
   problem it hit. It must NEVER return
   the plan content to you, and you must NEVER write or rewrite plan content yourself. Pass it:
   - the paths of `.spek/specs/NNN-slug/spec.md` and, if it exists, `.spek/constitution.md` (the
     subagent reads them itself; never paste artifact content into the prompt)
   - the technical context collected in step 3 (a short summary, not file contents)
   - the feature directory `.spek/specs/NNN-slug/` -- the subagent scaffolds `plan.md` in it and
     writes `research.md` there ONLY if it identifies the need for additional technical research
     (e.g. a library comparison); never paste template content into the prompt

   The scaffold script and the `PreToolUse` hook enforce the same rule: `plan.md` can only be
   created once `spec.md` exists, which step 2 already guarantees.

5. After the subagent reports completion, confirm that `.spek/specs/NNN-slug/plan.md` exists
   (`Glob` on the path, or `Read` of its first lines), and note from the notice whether
   `research.md` was written too. If `plan.md` is missing, stop and report the failure -- never
   fill the gap by writing the plan yourself.

6. Evaluate the plan's "Constitution Check" by reading the written `plan.md`: if any section
   violates a constitution principle without a justification documented in the "Complexity
   Tracking" table, stop and alert the user before proceeding.

7. Advance the state by running `${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh .spek/specs/NNN-slug set-phase plan`.
   The script sets `phase`, appends to `history`, and refreshes `updated` -- never hand-edit
   `state.json`.

8. Suggest `/spek:tasks` as the next step.

## Rules

- The plan documents the technical "how" -- never product/business decisions (those belong to the
  spec).
- If the project's stack is already established in the repository, the plan must NOT propose a
  different stack without explicit justification and user approval.
- Every constitution violation must be made explicit in the "Complexity Tracking" table of
  `plan.md` -- never silenced.
- Responsibilities are split and never swapped: the prerequisite checks (step 2) and the technical
  context gathering (step 3) are yours; the plan content (step 4) is the `spek:plan-architect`
  subagent's, which writes `plan.md` (and `research.md` when needed) directly and reports only
  completion -- the content never travels back through you.
