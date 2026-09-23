# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2026-09-15

### Added

- Handoff inside the feature: `update-state.sh` gained `set-handoff <in-progress|failed> "<note>"
  [T00X ...]` and `clear-handoff`, writing an optional `handoff` field in `state.json` (status,
  task list, note, timestamp). `/spek:implement` records each batch BEFORE dispatching it, clears
  the record when the batch succeeds and rewrites it as `failed` with the error summary when a
  task fails, so a session terminated mid-batch leaves an `in-progress` record behind. At the
  start of a run it reports the record, warns about possible partial edits and tells the
  implementer to inspect the files first. `set-phase` to any phase other than `implement` removes
  the record, so a regenerated `tasks.md` never leaves a stale task reference. `resolve-next.sh`
  exposes `handoff` on the feature object and names the tasks to resume in `next.reason`;
  `/spek:start`, `/spek:next` and `/spek:status` display it. Documented in `conventions.md`
  (schema, lifecycle, script contract).
- `plan-architect` never writes a language or dependency version it did not read from a
  repository file or hear from the user in the run; without evidence the field gets
  `NEEDS CLARIFICATION`.
- Constitution gained two sections, `## Documentation Policy` and `## Security & Data
  Constraints`, in the template and in the themes `/spek:constitution` asks about. Every theme
  question now offers "Recommend criteria for me": the command inspects the repository
  (manifests, lint/CI configs, tests, docs, auth and logging code) and proposes 2 to 4 verifiable
  principles with their evidence, which the user selects before anything is written.
- Language rule: every generated artifact (constitution, baseline, spec, plan, tasks, verify
  report, research, `state.json` notes) is written in English, whatever language the user writes
  in; questions, notices and summaries follow the user's language; identifiers and status labels
  stay literal. Normative in `conventions.md` (section "Language"), repeated in the
  `sdd-templates` skill, `PRINCIPLES.md`, `verifier`, `spec-clarifier`, `/spek:constitution`,
  `/spek:clarify`, `/spek:quick` and `/spek:implement`, since subagents do not see the session
  context.

### Changed

- Templates now live ONLY in the `sdd-templates` skill (`skills/sdd-templates/references/`); the
  `templates/` directory and `scripts/sync-templates.sh` are gone. The skill became the executor
  of artifact creation: `scripts/scaffold.sh <artifact> <feature-dir> [--force]` copies the
  template into `.spek/specs/NNN-slug/` (or `.spek/constitution.md`), strips `<!-- -->` guidance
  blocks, fills `[DATE]`/`[NNN-slug]`/`[PROJECT NAME]`, enforces the ordering rules and prints a
  JSON line. A `spec-light-template.md` makes the light-mode spec a real template
  (`scaffold.sh spec-light`).
- `code-archeologist`, `spec-writer`, `plan-architect` and `task-breaker` preload the skill via the
  `skills:` frontmatter field, scaffold their artifact with it and fill it in place with
  `Edit`/`MultiEdit`. Commands pass the order and the inputs (feature directory, mode, artifact
  paths); the subagent analyzes and decides; the skill executes. `/spek:constitution` and
  `/spek:quick` invoke the skill through the `Skill` tool and scaffold the same way.
- The artifact ordering rules moved to `scripts/lib/prereq.sh`, shared by the `PreToolUse` hook
  and the scaffold script, so creating a file through bash cannot bypass what the hook enforces.
- The `## Clarifications` marker in `spec.md` is now visible text instead of an HTML comment,
  since guidance comments are stripped at scaffold time.

- `/spek:specify` now estimates the `light`/`normal` mode itself (main agent, applying the
  detection criteria from `conventions.md`) instead of delegating the estimate to `spec-writer`.
- `spec-writer` regained `Write` and now writes `spec.md` directly at the path passed by the
  command, replying only with a completion notice -- the spec content no longer travels back
  through the main agent. `/spek:specify` verifies the file exists after the notice and never
  writes spec content itself; a light-mode request the subagent cannot honor is reported back
  (nothing written) and re-run in `normal` mode.
- Same contract for `/spek:plan` and `/spek:tasks`: `plan-architect` and `task-breaker` gained
  `Write` and write `plan.md` (plus `research.md` when needed) and `tasks.md` directly at the path
  passed by the command, replying only with a completion notice. The commands keep the
  prerequisite checks and state updates, verify the file exists after the notice, and `tasks`
  takes its counts from `sync-tasks` and a `Grep` over the written file. `Write`/`Edit` were
  removed from the three commands' `allowed-tools`.

- `/spek:quick` carries `disable-model-invocation: true` again (it was documented as such but the
  flag was missing) and lists `update-state.sh` in `allowed-tools`, with an explicit rule that
  `state.json` is never written directly.
- `/spek:implement` and `/spek:verify` no longer list a scoped `update-state.sh` entry next to the
  unrestricted `Bash` they need for builds and tests (the entry was redundant).
- Every hook in `hooks.json` declares an explicit 10-second `timeout`.
- Every agent has `AskUserQuestion`. The artifact writers (`spec-writer`, `plan-architect`,
  `task-breaker`) gained `Edit`, `MultiEdit` and `Bash` alongside `Write`, matching `implementer`.
- `code-archeologist` now writes `baseline.md` directly at the path passed by `/spek:extract` and
  replies only with a completion notice (path, `BR-00X` and `[CANNOT INFER]` counts), so the
  baseline content no longer travels back through the main agent. It gained the same editing set
  as the other artifact writers; its prompt restricts writes to `baseline.md` and `Bash` to
  read-only inspection. `/spek:extract` verifies the file exists after the notice and lost `Write`
  from its `allowed-tools`.
- `sdd-templates` skill declares its `name` and documents `baseline-template.md`.
- `.gitignore` excludes `.DS_Store` and `.claude/settings.local.json`; `tasks.json` stays local
  and `CLAUDE.md` says so.

- Template handoff is now uniform: every command passes the template as a PATH under
  `${CLAUDE_PLUGIN_ROOT}/templates/` (or, for light mode, the conventions file under the
  `sdd-templates` skill) and the subagent reads it itself; template content is never pasted into
  the prompt. `spec-writer`, `plan-architect`, `task-breaker` and `code-archeologist` state this
  in their input contracts, and the two agents whose templates carry `<!-- -->` guidance blocks
  drop them from the written artifact (keeping the `## Clarifications` marker in `spec.md`).
  `/spek:constitution` no longer describes the `templates/` path as a skill file.
- Same rule for earlier artifacts: `/spek:specify`, `/spek:plan`, `/spek:tasks`, `/spek:implement`
  and `/spek:verify` pass the PATHS of `spec.md`, `plan.md`, `baseline.md`, `tasks.md` and the
  constitution to their subagents, which read them; artifact content is never pasted into a
  subagent prompt.
- `verifier` now writes `verify-report.md` directly at the path passed by `/spek:verify` and
  replies only with a completion notice (path, verdict). It gained the editing set (`Write`,
  `Edit`, `MultiEdit`) alongside `Bash`; its prompt restricts writes to the report. `/spek:verify`
  verifies the file exists and takes the verdict from a `Grep` over it.

### Fixed

- The templates and `conventions.md` under `skills/sdd-templates/references/` were never committed:
  the `.gitignore` entry `references/` (meant for the root research corpus) matched that directory
  too, so a clone shipped `scaffold.sh` with nothing to scaffold. The entry is now anchored
  (`/references/`, alongside `/tasks.json`) and the skill's references are versioned.
- `new-feature.sh` accepts the slug after `--`; previously anything following `--` was discarded
  and the script failed with a missing `<slug>` error.
- `plugin.json` `homepage` and `repository` point to the plugin's own repository instead of the
  marketplace repository.
- `README.md` accuracy: light mode is suggested and confirmed, never applied automatically; `jq`
  is a hard requirement (only the hook degrades without it); `/spek:quick` estimates the mode like
  `/spek:specify`; baseline gaps use the `[CANNOT INFER: reason]` form.
- `verify-report.md` had no writer: `/spek:verify` lacked `Write` and so did `verifier`. The
  subagent now writes it (see Changed).
- `tasks-template.md` lost a stray YAML frontmatter (`description:`) that would otherwise be
  copied into every generated `tasks.md`.
- `new-feature.sh` emits its JSON through `jq`, so a project path containing quotes or
  backslashes no longer produces invalid output. `jq` is now a declared requirement of the script.
- `check-phase-prereq.sh` degrades to a no-op on an unparseable hook payload instead of exiting
  with a `jq` parse error.
- `lib/state.sh` receives the target file name as an argument instead of reading a global.
- Shell cleanups: `done` is no longer used as a variable name (shellcheck SC1010) and
  `sync-templates.sh` counts files without parsing `ls`.
- `check-phase-prereq.sh` now normalizes a relative `file_path` against the hook payload's `cwd`
  (falling back to its own working directory) before applying the `.spek/specs/` filter. A
  relative path such as `.spek/specs/NNN-slug/plan.md` previously fell through the filter and
  bypassed the gate silently. An empty `file_path` exits early as a no-op.
- `.claude/CLAUDE.md` described the hook as acting only on feature dirs containing `state.json`;
  the script has always gated every dir under `.spek/specs/` by file presence alone. The
  description now matches the script.

## [0.5.0] - 2026-09-07

### Added

- `/spek:start` and `/spek:next`: navigation commands that run the right phase command instead of
  telling the user which one to type. `start` detects the project state (missing constitution,
  active feature, greenfield vs brownfield) and invokes `constitution`, `specify`, `extract` or
  `next`; `next` resolves the current feature and invokes exactly one step (`specify`, `clarify`,
  `plan`, `tasks`, `implement` or `verify`). Both only ask the user for decisions or for inputs
  the target command cannot run without.
- `scripts/resolve-next.sh`: read-only resolver with a stable JSON contract (project facts, current
  feature, inferred phase when `state.json` is missing, next command with reason). It is the single
  implementation of the phase -> next command map, now documented in `conventions.md`, section
  "Navigation". `/spek:next` restores an inferred `state.json` through `update-state.sh`.
- `/spek:specify` accepts `--slug=<slug>`, used by `/spek:next` to hand a brownfield feature from
  `extract` to `specify` inside the same feature directory.

### Changed

- `/spek:constitution` no longer sets `disable-model-invocation: true`, so `/spek:start` can invoke
  it through the `Skill` tool; it still runs only on explicit request (directly or via `start`).
  `/spek:quick` keeps the flag.
- `/spek:status` reports the next step from `resolve-next.sh` instead of an inline map, and points
  to `/spek:next` and `/spek:start`.
- The "current feature" rule (most recently updated feature that is not `verified`/`archived`) is
  now stated once in `conventions.md` and referenced by `plan` and `clarify`.

## [0.4.0] - 2026-08-30

### Added

- `PRINCIPLES.md`: the plugin's SDD operating principles (artifacts over memory, ambiguity
  resolved never assumed, narrow specs, evidence over claims, phase discipline and
  proportionality, respect for existing code), injected into the session context at `SessionStart`
  by the new `inject-principles.sh` hook -- only in projects that contain a `.spek/` directory.

### Changed

- Agent tool audit: `spec-clarifier` gained `AskUserQuestion` and now elicits answers directly
  (unlimited questions and rounds, with a non-interactive fallback); `spec-writer` lost `Write`
  and `plan-architect` lost `Bash` (dead privileges). `/spek:constitution` gained
  `AskUserQuestion` and a vagueness check: vague principles become questions with concrete
  verifiable restatements as options, never assumed interpretations.

## [0.3.0] - 2026-08-30

### Changed

- All generated artifacts moved under a single namespaced directory: `specs/NNN-slug/` is now
  `.spek/specs/NNN-slug/`, alongside `.spek/constitution.md`. This removes the collision risk with
  other tools that use a top-level `specs/` directory (GitHub spec-kit and others) and leaves a
  single plugin-owned directory in the user's repository.
- The per-feature state file `.spek-state.json` was renamed to `state.json` (the `.spek-` prefix is
  redundant inside the namespaced directory).
- The phase-prerequisite hook dropped its managed-directory guard: everything under `.spek/specs/`
  is spek-owned by definition, so every feature directory is gated, including hand-created ones.

### Migration

- Pre-0.3.0 features: move `specs/NNN-slug/` into `.spek/specs/NNN-slug/` and rename each
  `.spek-state.json` to `state.json`. No content changes are needed.

## [0.2.0] - 2026-08-30

### Added

- `/spek:extract` command and `code-archeologist` subagent, the brownfield entry point of the SDD
  flow: reads existing code and writes `specs/NNN-slug/baseline.md` with numbered `BR-00X`
  responsibility entries and explicit `[CANNOT INFER]` gaps, under a hard 50-file scope limit
  (research-backed -- a larger scope exceeds human review capacity and produces a baseline nobody
  can honestly review).
- Three-zone `## Scope Boundaries` section in `spec.md`: `### What Changes`, `### What Must Be
  Preserved` (`PR-00X` preservation requirements promoted from a baseline's `BR-00X` entries), and
  `### Out of Scope`.
- Dual-target `/spek:verify`: alongside the existing `FR`/`SC`/`PR` check against `spec.md`, when a
  `baseline.md` exists the verifier cross-checks it too and adds a `## Baseline Preservation`
  section to `verify-report.md` (Preserved / Changed (intentional) / Possibly Regressed / Cannot
  Assess) -- advisory only, it never gates the `verified` phase transition.
- `context` field (`greenfield|brownfield`) in `.spek-state.json`, independent of `mode`, and a new
  `extract` phase preceding `specify` in the lifecycle.
- `scripts/update-state.sh`: the single writer of `.spek-state.json`, generating real ISO-8601
  timestamps and providing `sync-tasks` to derive `totalTasks`/`completedTasks` from the checkboxes
  in `tasks.md` instead of hand-incrementing counters.
- Light-mode spec format defined in the `sdd-templates` skill's `references/conventions.md`
  (condensed header block, `## Change Description`, `## Functional Requirements`,
  `## Acceptance Check`, `## Clarifications`).

### Changed

- `/spek:implement` scope semantics clarified and hardened: no scope argument runs the entire next
  pending phase and stops; `--all` runs every pending phase sequentially in one invocation, stopping
  at the first failed task.
- `check-phase-prereq.sh` hook hardened: guards writes to files outside the managed
  `specs/`/`.spek/` directories, degrades to a no-op (never blocks) when `jq` is unavailable, and
  enforces baseline immutability -- `baseline.md` becomes read-only once `spec.md` exists in the
  same feature directory.
- `/spek:specify` reordered so the feature's `mode` (light/normal) is resolved before any spec
  content is written, avoiding a rewrite when the resolved mode changes the expected format; it also
  now recognizes the brownfield path (an existing `baseline.md` with state already in phase
  `extract`) and advances the existing state instead of re-initializing it.

## [0.1.0] - 2026-08-30

### Added

- 9 slash commands under the `/spek:` namespace covering the full spec-driven development cycle:
  `constitution`, `specify`, `clarify`, `plan`, `tasks`, `implement`, `verify`, `status`, and the
  condensed `quick` flow.
- 6 phase-specific subagents, each scoped to the minimal tools required: `spec-writer`,
  `spec-clarifier`, `plan-architect`, `task-breaker`, `implementer`, and `verifier`.
- `sdd-templates` skill, centralizing the canonical spec/plan/tasks/constitution templates and the
  on-disk conventions (feature naming, state schema, mode detection).
- 2 hooks: a `SessionStart` hook that injects the project constitution into session context, and a
  `PreToolUse` hook that gates writes to `plan.md`/`tasks.md` on their phase prerequisites.
- 4 canonical templates (spec, plan, tasks, constitution), kept in sync with the skill's reference
  copies via `scripts/sync-templates.sh`.
- `scripts/new-feature.sh` for deterministic, collision-free sequential feature numbering under
  `specs/`.
- On-disk `.spek-state.json` state model tracking feature mode, phase, phase history, and task
  counters, with automatic light/normal mode detection and manual override support.

## Change History
- Created: 2026-08-30
- Updated: 2026-08-30 - Brownfield positioning: extract command, three-zone specs, dual-target verify (0.2.0)
- Updated: 2026-08-30 - 0.3.0: artifacts consolidated under .spek/, state file renamed to state.json
- Updated: 2026-08-30 - 0.4.0: PRINCIPLES.md session injection, agent tool audit, constitution vagueness check
- Updated: 2026-09-07 - 0.5.0: navigation commands start/next, resolve-next.sh, specify --slug
- Updated: 2026-09-07 - Unreleased: specify owns the mode estimate, spec-writer writes spec.md directly
- Updated: 2026-09-07 - Unreleased: plan-architect and task-breaker write their artifacts directly
- Updated: 2026-09-07 - Unreleased: hook normalizes relative paths; CLAUDE.md hook description corrected
- Updated: 2026-09-07 - Unreleased: plugin structure review fixes (quick flag, hook timeouts, jq JSON, skill name)
- Updated: 2026-09-07 - Unreleased: agent tool update (AskUserQuestion, editing set for artifact writers)
- Updated: 2026-09-07 - Unreleased: code-archeologist writes baseline.md directly
- Updated: 2026-09-07 - Unreleased: uniform template handoff by path; tasks-template frontmatter removed
- Updated: 2026-09-07 - Unreleased: artifacts handed to subagents by path; verifier writes verify-report.md
- Updated: 2026-09-08 - Unreleased: sdd-templates skill owns and scaffolds the templates; templates/ removed
- Updated: 2026-09-09 - Unreleased: handoff record in state.json; plan-architect version-evidence rule
- Updated: 2026-09-09 - Unreleased: constitution sections for documentation and security; recommended criteria on request
- Updated: 2026-09-09 - Unreleased: language rule for generated artifacts and conversation
- Updated: 2026-09-15 - Unreleased: skill references versioned (.gitignore anchored), new-feature.sh -- fix, plugin.json URLs, README accuracy
- Updated: 2026-09-15 - 0.6.0: Unreleased changes released
