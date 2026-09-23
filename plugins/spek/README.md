# spek

SDD for the code you already have. A standalone Claude Code plugin for spec-driven development
(SDD), designed first for the brownfield case -- a codebase that already exists -- while fully
supporting new projects through the canonical greenfield flow. The spec is the primary artifact
and the source of truth for a feature; code is a derived output generated from it. The plugin runs
a full constitution -> specify -> clarify -> plan -> tasks -> implement -> verify pipeline for
large features, and suggests a condensed light mode for small, low-risk changes, applied only
after you confirm it. For existing code, `/spek:extract` comes first, anchoring the change to a
reviewed baseline of current behavior.

## Requirements

`bash` and `jq` must be available on `PATH`; both are hard requirements. `jq` is used by every
helper script under `scripts/` (`new-feature.sh`, `update-state.sh`, `resolve-next.sh`), by the
skill's scaffold script and by the phase-prerequisite hook (`check-phase-prereq.sh`) to read,
validate and emit JSON (`state.json`, the feature and navigation contracts). Without `jq`, the
helper scripts and the scaffold script stop with an error, so no command can create or advance a
feature. The hook is the only exception: it degrades to a no-op instead of blocking, so a missing
`jq` never breaks an unrelated write.

## Installation

Install from a marketplace:

```
/plugin marketplace add Digital-Republic-AI/dr-plugins
/plugin install spek@dr-plugins
```

Or run it directly from a local clone for development:

```
claude --plugin-dir /path/to/spek-plugin
```

## Commands

All commands are namespaced under `/spek:`.

| Command | Description |
|---|---|
| `/spek:start` | Starts or resumes the SDD flow by detecting the project state and running the right entry command (constitution, specify, extract or next) |
| `/spek:next` | Runs the next natural SDD step for the current feature (specify, clarify, plan, tasks, implement or verify) without the user having to pick the command |
| `/spek:constitution` | Creates or updates the project constitution (the engineering principles every spec and plan must respect) |
| `/spek:extract` | Extracts the baseline spec of existing code into .spek/specs/NNN-slug/baseline.md - the brownfield entry point of the SDD flow |
| `/spek:specify` | Transforms a natural-language description into a structured feature specification |
| `/spek:clarify` | Resolves `[NEEDS CLARIFICATION]` markers in an existing spec through objective questions |
| `/spek:plan` | Generates the technical implementation plan from the spec (stack, architecture, project structure) |
| `/spek:tasks` | Decomposes the plan into a list of executable tasks, grouped by user story and with explicit dependencies |
| `/spek:implement` | Executes a feature's pending tasks, one by one or in parallel batches, updating progress |
| `/spek:verify` | Verifies whether the implementation meets the spec's success criteria and the constitution's principles |
| `/spek:status` | Shows the dashboard of all SDD features in the project and the current phase of each one |
| `/spek:quick` | Condensed specify+plan+tasks flow in a single interaction, for small-to-medium changes |

## Workflow

The canonical cycle:

```
/spek:constitution   (optional, once per project)
        |
        v
/spek:specify -> /spek:clarify (if needed) -> /spek:plan -> /spek:tasks -> /spek:implement -> /spek:verify
```

Artifacts are always written in English, whatever language you write in; questions, notices and
summaries follow your language. Identifiers such as `FR-001` and status labels stay literal.

`/spek:constitution` collects objectively verifiable principles under seven themes: architecture,
code conventions, testing, dependencies, documentation, security and data, and merge-blocking
criteria. Each question offers "Recommend criteria for me": the command inspects the repository
(manifests, lint and CI configs, tests, docs, auth and logging code) and proposes candidates
grounded in what it found, which you select before anything is written. Vague answers such as
"well tested" are never interpreted; they come back as concrete restatements to choose from.

`/spek:implement` with no scope argument runs the entire next pending phase and then stops, so each
invocation advances the feature by one phase; `--all` runs every pending phase sequentially in a
single invocation, stopping at the first failed task. `--task ID` and `--story US1` narrow the run
to a single task or a single user story. Task counters in `state.json` are always derived from the
checkboxes in `tasks.md`, never incremented, so progress cannot drift from the artifact.

An interrupted run leaves a `handoff` behind in `state.json`: `/spek:implement` records each batch
before dispatching it, clears the record when the batch succeeds, and rewrites it with the error
summary when a task fails. A session terminated mid-batch therefore leaves an `in-progress`
record, and the next run (or `/spek:next`, `/spek:start`, `/spek:status`) reports which tasks were
underway, warns that their files may hold partial edits, and resumes them.

`/spek:quick` collapses specify, plan and tasks into a single interaction with one consolidated
confirmation, for medium-complexity changes; it estimates the mode the same way `/spek:specify`
does, so a light suggestion is still confirmed with you. `/spek:status`
is the dashboard: it scans every feature under `.spek/specs/` and reports its mode, phase, and task
progress, ordered by most recently updated.

You do not have to remember the order. `/spek:start` looks at what the project already has and runs
the right entry command itself: it offers to create the constitution when it is missing, offers to
continue a feature that is already in progress, and otherwise opens a new one through
`/spek:specify` (from a description) or `/spek:extract` (from a path to existing code). From then
on, `/spek:next` runs the next natural step for the current feature -- `clarify` while the spec
still has `[NEEDS CLARIFICATION]` markers, then `plan`, `tasks`, `implement` (one phase per run),
and `verify` -- one step per invocation. Both commands invoke the target command directly and only
stop to ask for a decision or for an input the target command cannot run without. The next step is
resolved by `scripts/resolve-next.sh` from `state.json` and the artifacts on disk, never from
conversation memory, so it works the same in a brand-new session.

## Brownfield workflow

For code that already exists, the cycle starts one step earlier:

```
/spek:extract <path>
        |
        v
/spek:specify -> /spek:clarify (if needed) -> /spek:plan -> /spek:tasks -> /spek:implement -> /spek:verify
```

`/spek:extract` reads the given module or directory and writes `.spek/specs/NNN-slug/baseline.md`: a
numbered list of `BR-00X` entries describing what the code does today, with
`[CANNOT INFER: reason]` marking whatever cannot be established from the code alone. Review it
before moving on -- it is a draft until a human confirms it. The scope is capped at a hard 50-file
limit: comprehensive extraction
beyond that exceeds human review capacity and produces a baseline nobody can honestly review, so
`/spek:extract` refuses and asks for a narrower module instead of sampling files or extracting
partially.

`/spek:specify` then writes `spec.md` with three zones under `## Scope Boundaries`: `### What
Changes` (the actual delta), `### What Must Be Preserved` (existing `BR-00X` entries promoted into
`PR-00X` preservation requirements), and `### Out of Scope`. From there the flow rejoins the
canonical cycle -- clarify, plan, tasks, implement -- unchanged. At the end, `/spek:verify` checks
two targets: the change spec (`FR`/`SC`/`PR`, as usual) and, when a baseline exists, a Baseline
Preservation report cross-checking every `BR-00X` entry against the current code. That report is
advisory -- it never gates the `verified` phase transition, it only surfaces what to review.

Once `spec.md` exists in a feature directory, `baseline.md` becomes immutable: it is the approved
historical record of how the system was, and the phase-prerequisite hook blocks further writes to
it. A fresh baseline means a fresh `/spek:extract` run into a new feature.

## Light vs normal mode

Mode is estimated by the main agent of `/spek:specify` (and of `/spek:quick`, which runs the same
logic), based on the estimated blast radius of the change; the `spec-writer` subagent then writes
`spec.md` directly in the resolved format and only reports completion. `normal` is the default and
proceeds directly; a `light` suggestion -- the only one that skips pipeline phases -- is always
confirmed with you before it is applied:

- **Light mode**: triggered when the change affects <= 3 files and < 10 lines of code, or is
  purely cosmetic/copy. It generates a condensed `spec.md` and skips `/spek:plan` and `/spek:tasks`
  entirely, going straight to `/spek:implement`.
- **Normal mode**: everything else (new components/APIs, new external dependencies, changes to an
  API contract or data schema, or multiple non-trivial user stories). It runs the full pipeline.

`/spek:specify` accepts an explicit `--mode=light|normal` override (e.g.
`/spek:specify --mode=normal "..."`) for cases where a small change still deserves formal review;
it skips both the estimate and the confirmation. `/spek:start` passes the flag through when you
include it in the description. `/spek:verify` always runs at the end, regardless of mode --
verification is never skipped.

## Generated artifacts

Everything the plugin produces is written into the user's own repository and versioned in git
alongside the code, so specs can be reviewed in a pull request like any other engineering artifact:

```
<your-project-root>/
└── .spek/
    ├── constitution.md          # single, global to the project (phase 0)
    └── specs/
        ├── 001-login-google/
        │   ├── spec.md
        │   ├── research.md          # optional
        │   ├── plan.md
        │   ├── tasks.md
        │   ├── verify-report.md     # generated by /spek:verify
        │   └── state.json
        └── 002-payment-gateway/
            ├── baseline.md          # generated by /spek:extract (brownfield only)
            ├── spec.md
            └── ...
```

`state.json` tracks each feature's `mode`, current `phase`, phase `history`, task counters,
associated git branch and, while an implementation run is interrupted, a `handoff` record (the
batch in progress or the failed tasks, with a note), so a brand-new session can resume exactly
where a feature stopped without relying on conversation memory. It also tracks a `context` field
(`greenfield` or `brownfield`), independent of `mode`: `greenfield` for a feature started with
`/spek:specify` directly, `brownfield` for one that started with `/spek:extract`.

## Walkthrough

A minimal end-to-end run for one feature:

```
/spek:specify "add CSV export to the reports page"
# review the generated spec.md

/spek:clarify
# answer any [NEEDS CLARIFICATION] questions

/spek:plan
# review the generated plan.md (stack, architecture, project structure)

/spek:tasks
# review the generated tasks.md (ordered, grouped by user story)

/spek:implement --all
# executes pending tasks, one by one or in parallel [P] batches

/spek:verify
# cross-checks the implementation against spec.md's requirements and success criteria
```

The same run, letting the plugin pick each command:

```
/spek:start "add CSV export to the reports page"
# offers to create the constitution if missing, then runs /spek:specify

/spek:next
# runs /spek:clarify, or /spek:plan when there is nothing to clarify

/spek:next
# runs /spek:tasks ... and so on, one step per invocation, until /spek:verify
```

## How it works

- **Subagents per phase**, each scoped to the tools its phase needs, and every one of them with
  `AskUserQuestion` so it can ask instead of guessing: `code-archeologist` (`baseline.md`),
  `spec-writer` (`spec.md`), `plan-architect` (`plan.md`/`research.md`), `task-breaker`
  (`tasks.md`), `verifier` (`verify-report.md`) and `implementer` (code) carry the full editing
  set (`Write`, `Edit`, `MultiEdit`, `Bash`); `spec-clarifier` is read-only. The artifact
  writers write their file directly and report only completion to the command, which never
  carries artifact content itself; commands hand over the feature directory and the paths of
  earlier artifacts, never their content. The templated writers preload the `sdd-templates`
  skill and create their file through its scaffold script, then fill it in place.
  `code-archeologist` only ever writes `baseline.md` and never executes the code it is reading.
- **Hooks**: a `SessionStart` hook injects the project constitution into every session's context
  when `.spek/constitution.md` exists, so all commands and subagents respect it automatically. A
  second `SessionStart` hook injects the plugin's own SDD operating principles (`PRINCIPLES.md`)
  in any project that contains a `.spek/` directory. A `PreToolUse` hook (matching
  `Write|Edit|MultiEdit`) blocks writes to `plan.md` or `tasks.md` when
  the previous phase's prerequisite artifact is missing, and blocks writes to `baseline.md` once
  `spec.md` exists, preventing the flow from being run out of order. The same rules live in
  `scripts/lib/prereq.sh` and are applied by the scaffold script, so a write through bash cannot
  bypass them.
- **On-disk state**: `state.json` is the source of truth for each feature's phase, so work
  survives session interruptions -- a command reads the state file first, and falls back to
  inferring phase from which artifacts physically exist if the state file is missing or corrupted.
- **Navigation**: `scripts/resolve-next.sh` is the single, read-only implementation of "which
  feature is current" and "what comes next" (documented in `conventions.md`, section
  "Navigation"). `/spek:start`, `/spek:next` and `/spek:status` consume its JSON; the first two then
  invoke the target command through the `Skill` tool, so the user never has to pick it.
- **The `sdd-templates` skill** is the single home of the artifact templates (baseline, spec,
  light spec, plan, tasks, constitution) and of the on-disk conventions, and it executes the
  mechanical part of writing one: `scripts/scaffold.sh` copies the template into
  `.spek/specs/NNN-slug/` (or `.spek/constitution.md`), strips the writer-only guidance, fills the
  header fields and enforces the same ordering rules as the hook. It is preloaded into the
  artifact-writing subagents; the command orders, the subagent decides, the skill executes.

## License

MIT. See [LICENSE](LICENSE).

## Change History
- Created: 2026-08-30
- Updated: 2026-08-30 - Added Requirements section (bash, jq)
- Updated: 2026-08-30 - Implement scope semantics (--all runs all pending phases) and derived task counters
- Updated: 2026-08-30 - Brownfield positioning: extract command, three-zone specs, dual-target verify (0.2.0)
- Updated: 2026-08-30 - Mode suggestion now requires user confirmation before being applied
- Updated: 2026-08-30 - Mode confirmation narrowed to light suggestions only (normal proceeds directly)
- Updated: 2026-08-30 - Artifacts consolidated under .spek/ (specs and state.json) in 0.3.0
- Updated: 2026-08-30 - PRINCIPLES.md injected at SessionStart (0.4.0)
- Updated: 2026-09-07 - Navigation commands /spek:start and /spek:next (0.5.0)
- Updated: 2026-09-07 - Mode estimate owned by /spek:specify; spec-writer writes spec.md directly
- Updated: 2026-09-07 - plan-architect and task-breaker write plan.md/tasks.md directly
- Updated: 2026-09-07 - Requirements: jq is used by every helper script under scripts/
- Updated: 2026-09-07 - Agent tools: AskUserQuestion everywhere; artifact writers get Edit, MultiEdit, Bash
- Updated: 2026-09-07 - code-archeologist writes baseline.md directly
- Updated: 2026-09-07 - verifier writes verify-report.md directly; handoff to subagents by path
- Updated: 2026-09-08 - sdd-templates skill owns the templates and scaffolds artifacts; templates/ removed
- Updated: 2026-09-09 - handoff record in state.json for interrupted or failed implementation runs
- Updated: 2026-09-09 - constitution: documentation and security sections; recommended criteria on request
- Updated: 2026-09-09 - language rule: artifacts in English, conversation in the user's language
- Updated: 2026-09-09 - Accuracy pass: title, --mode override is specify-only, hook also freezes baseline.md, jq in scaffold
- Updated: 2026-09-15 - Accuracy pass: light mode needs confirmation, jq is a hard requirement, quick also estimates the mode, CANNOT INFER form, prose rewrapped
