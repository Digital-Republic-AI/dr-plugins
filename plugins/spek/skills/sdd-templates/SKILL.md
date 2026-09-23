---
name: sdd-templates
description: Owns the canonical SDD artifact templates (baseline, spec, light spec, plan, tasks, constitution) and the on-disk conventions, and scaffolds any of them into the feature directory through a deterministic script. Preloaded into the artifact-writing subagents; use whenever an SDD artifact must be created, filled or reviewed, or when determining what phase a feature is in.
user-invocable: false
---

# SDD Templates

This skill is the single home of the SDD artifact templates and the executor that turns a
template into a file. The subagent that carries it does the thinking (analyzing input, deciding
content); this skill does the mechanical part: copying the right template to the right place,
stripping writer-only guidance, filling the deterministic header fields, and telling you what is
left to fill.

## Where artifacts live

Feature artifacts are always written inside the feature directory `.spek/specs/NNN-slug/` of the
user's project (`baseline.md`, `spec.md`, `research.md`, `plan.md`, `tasks.md`, `verify-report.md`,
`state.json`). The constitution is the single exception: `.spek/constitution.md` at the project
root. Never write an artifact anywhere else, and never write `state.json` by hand (only
`update-state.sh` does).

## Scaffolding an artifact

Run the scaffold script with `Bash`, then fill the placeholders it leaves with `Edit`/`MultiEdit`:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/scaffold.sh" <artifact> <feature-dir> [--force]
```

| `<artifact>`   | Template                     | Written to                               |
|----------------|------------------------------|------------------------------------------|
| `baseline`     | `baseline-template.md`       | `<feature-dir>/baseline.md`              |
| `spec`         | `spec-template.md`           | `<feature-dir>/spec.md`                  |
| `spec-light`   | `spec-light-template.md`     | `<feature-dir>/spec.md` (light mode)     |
| `plan`         | `plan-template.md`           | `<feature-dir>/plan.md`                  |
| `tasks`        | `tasks-template.md`          | `<feature-dir>/tasks.md`                 |
| `constitution` | `constitution-template.md`   | `<project-root>/.spek/constitution.md` (pass the project root, or nothing) |

What the script does, deterministically:

- copies the template and removes every `<!-- ... -->` guidance block (they are instructions to
  you, never artifact content);
- fills `[DATE]` (today, UTC), `[NNN-slug]`/`[NNN-feature-slug]` (from the feature directory name)
  and, for the constitution, `[PROJECT NAME]`;
- enforces the artifact ordering rules (plan needs spec, tasks needs plan, baseline is frozen once
  spec exists) and refuses to overwrite an existing file unless `--force` is passed;
- prints one JSON line: `{"artifact","path","template","feature","placeholders","overwritten"}`.
  `placeholders` is how many `[UPPERCASE ...]` tokens remain for you to fill.

Then edit the scaffolded file in place with `Edit`/`MultiEdit`. Every remaining `[PLACEHOLDER]` must
be replaced with real content or deleted together with its optional subsection; a finished artifact
contains no template placeholders. Keep the section structure exactly as scaffolded: do not add
top-level sections, do not drop mandatory ones. Artifacts without a template (`research.md`,
`verify-report.md`) are written with `Write` directly into the feature directory.

If the script refuses (ordering rule, existing file), report the refusal to the caller instead of
working around it with `Write`.

## Language

Artifacts are written in English, whatever language the user or the caller used; only text a
template records verbatim as user input is kept as given. Identifiers, headings and status labels
stay literal. Questions to the user go in the user's language. (Normative statement in
`conventions.md`, section "Language".)

## Reading the conventions

`${CLAUDE_SKILL_DIR}/references/conventions.md` is the normative document for the on-disk model:
feature directory naming, the `state.json` schema, phase detection, navigation, the brownfield
flow and the light-vs-normal mode criteria. Read it (or the section you need) when a question
about layout, phase or mode comes up; the templates themselves live next to it under
`${CLAUDE_SKILL_DIR}/references/` and are the files the scaffold script copies.

## Artifact guidance

- `baseline.md` -- what existing code does TODAY, as `BR-00X` entries with `[CANNOT INFER: reason]`
  markers for anything not provable from code. Immutable once `spec.md` exists.
- `spec.md` (normal) -- prioritized User Stories, `FR-00X`, `SC-00X`, and the three
  `## Scope Boundaries` zones (What Changes / What Must Be Preserved as `PR-00X` / Out of Scope).
- `spec.md` (light) -- Change Description, `FR-00X`, Acceptance Check, Clarifications. No user
  stories, no `SC-00X`. If the change needs them, it is not light: report back, do not stretch it.
- `plan.md` -- Technical Context with concrete values (or `NEEDS CLARIFICATION`), the mandatory
  Constitution Check, one real project structure, Complexity Tracking for every violation.
- `tasks.md` -- `[ID] [P?] [Story] Description with exact file path`, phases Setup / Foundational /
  per User Story / Polish; counters are derived from its checkboxes by `update-state.sh sync-tasks`.
- `constitution.md` -- objectively verifiable principles only; vague ones become questions.
