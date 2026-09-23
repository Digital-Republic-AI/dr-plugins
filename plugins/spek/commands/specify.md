---
description: Transforms a natural-language description into a structured feature specification
argument-hint: "<feature description in natural language> [--mode=light|normal] [--slug=<slug>]"
allowed-tools: Read, Glob, Grep, AskUserQuestion, Bash(git branch:*), Bash(git checkout:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/new-feature.sh:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh:*)
---

# Specify

You are starting the SDD cycle for a new feature from the user's description: `$ARGUMENTS`

## Steps

1. Derive a short kebab-case slug from the description (e.g. "add Google login" -> `google-login`).
   If `$ARGUMENTS` contains an explicit `--slug=<slug>` flag, use that slug instead of deriving one
   and strip the flag from the description before passing it on -- this is how `/spek:next` hands a
   brownfield feature from `extract` to `specify` inside the same `.spek/specs/NNN-slug/` directory.
   Then run `${CLAUDE_PLUGIN_ROOT}/scripts/new-feature.sh <slug>` to deterministically resolve the
   next sequential feature number, create the `.spek/specs/NNN-slug/` directory, and get back a JSON
   contract (`feature`, `number`, `slug`, `dir`, `branch`). Never compute the number or create the
   directory yourself -- the script is the single source of truth for numbering. If the script
   reports `"existing": true`, the slug already has a feature directory: apply the rule below about
   revising an existing spec.

2. Resolve the feature's mode BEFORE writing any spec content, so the spec is produced in the right
   format the first time and never has to be rewritten (see the `spek:sdd-templates` skill, file
   `references/conventions.md`, section "Light vs normal mode"):
   - If `$ARGUMENTS` contains an explicit `--mode=light` or `--mode=normal` override, that override
     wins and no estimation is needed.
   - Otherwise, estimate the complexity YOURSELF -- never delegate this estimate to a subagent. Do
     a quick pass over the user's description and, when useful, a light scan of the related code
     (`Grep`/`Glob`), and apply the detection criteria of the `spek:sdd-templates` skill, file
     `references/conventions.md`, section "Light vs normal mode": estimated affected files,
     estimated lines of code, number of identifiable user stories, new external dependencies,
     API-contract/data-schema impact.
   - Recap: a trivial change (estimated <= 3 files and < 10 lines, or a purely cosmetic/copy change,
     with 0 or 1 trivial user story, no new dependency and no API-contract/data-schema impact) is
     `light`; anything else is `normal`. When signals conflict or the description is too thin to
     estimate, the estimate is `normal`.
   - `normal` is the default: when the estimate is `normal`, proceed without asking -- the
     full flow is never a downgrade. Only a `light` suggestion requires confirmation, because light
     skips `/spek:plan` and `/spek:tasks`: present it via `AskUserQuestion` with `light` as the
     recommended option and `normal` as the alternative, including the rationale (estimated
     files/lines, and that light skips plan/tasks while normal runs the full flow) in the option
     descriptions. The mode written to the state is always the one the user confirmed. An explicit
     `--mode=` override in `$ARGUMENTS` skips estimation and confirmation entirely -- the user has
     already decided.

3. Delegate the writing of `.spek/specs/NNN-slug/spec.md` to the `spek:spec-writer` subagent,
   invoking it ONCE in the mode resolved in step 2. The subagent scaffolds the file through its
   preloaded `sdd-templates` skill, fills it in place, and returns only a short completion notice -- the target path, the mode it wrote
   in and any problem it hit. It must NEVER return the spec content to you, and you must NEVER
   write or rewrite spec content yourself. Pass it:
   - the user's original description
   - the feature directory: the `dir` returned by `new-feature.sh` in step 1
   - the resolved mode. The subagent scaffolds the matching template itself (`spec` for `normal`,
     with the three zones of `## Scope Boundaries`; `spec-light` for `light`, with
     `## Change Description`, `## Functional Requirements`, `## Acceptance Check`,
     `## Clarifications`) -- never paste template or conventions content into the prompt.
   - whether this is a revision of an existing `spec.md` (the user chose to revise in the Rules
     below), so the subagent edits the existing file in place instead of scaffolding a new one
   - the path `.spek/constitution.md`, if the file exists, as a context constraint the subagent reads
     itself (never paste its content into the prompt)

   If the subagent reports back that the change does not fit the `light` format (it needs User
   Stories, Success Criteria or numbered `PR-00X` entries), it has written nothing: treat the mode
   as `normal`, tell the user why, and invoke the subagent once more in `normal` mode.

4. After the subagent reports completion, confirm that `.spek/specs/NNN-slug/spec.md` exists
   (`Glob` on the path, or `Read` of its first lines). If the file is missing, stop and report the
   failure -- never fill the gap by writing the spec yourself.

5. Create the state file with the mode already resolved in step 2, by running:
   `${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh <dir> init <feature> <slug> <mode>`
   using the `dir`, `feature` and `slug` values returned by `new-feature.sh` in step 1. In the normal
   path no correction pass is needed, because the mode was decided before the spec was written. The
   script is the ONLY writer of `state.json` -- never create or hand-edit that file yourself.
   It refuses to overwrite an existing state file; if it reports that the file already exists (a
   revision of an existing feature), leave the existing state alone and use
   `update-state.sh <dir> set-mode <mode>` only if the mode decision actually changed.

   **Brownfield path**: if the feature directory already contains a `baseline.md`, `/spek:extract`
   ran first and the state file already exists in phase `extract` -- `init` would refuse to
   overwrite it. Do not call `init` in that case: keep the existing state and run
   `${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh <dir> set-phase specify` instead (plus `set-mode`
   only if the mode decision actually changed). The `context` field stays `brownfield`, as extract
   set it. With no `baseline.md`, `init` is the right call and `context` defaults to `greenfield`.

   The script writes the following schema (shown here only as documentation -- the script owns the
   writes and generates all timestamps itself):
   ```json
   {
     "feature": "NNN-slug",
     "slug": "slug",
     "mode": "normal",
     "context": "greenfield",
     "phase": "specify",
     "created": "<ISO-8601 timestamp>",
     "updated": "<ISO-8601 timestamp>",
     "history": ["specify"],
     "branch": null
   }
   ```
   `branch` stays `null` until the git branch is created in step 7. `totalTasks` and
   `completedTasks` are added later by `/spek:tasks`.

6. Tell the user what the resolved mode implies:
   - `light`: `/spek:plan` and `/spek:tasks` will be skipped. Suggest `/spek:implement`, which works
     from the FRs and the Acceptance Check of the condensed spec.
   - `normal`: the next step is `/spek:clarify` (if there are `[NEEDS CLARIFICATION]` markers in the
     spec) or `/spek:plan`.

7. Optionally, offer to create the feature's git branch (`git checkout -b NNN-slug`) -- ask before
   executing. After the branch is actually created, record it by running
   `${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh <dir> set-branch <branch>`.

8. Show a summary of the created spec: number of user stories, number of functional requirements,
   the Scope Boundaries counts (entries under `### What Changes`, preservation requirements
   `PR-00X` under `### What Must Be Preserved`, and entries under `### Out of Scope`), and any
   pending `[NEEDS CLARIFICATION]` markers. Every count MUST come from an actual `Grep` over the
   written `.spek/specs/NNN-slug/spec.md` (e.g. pattern `NEEDS CLARIFICATION` and pattern `PR-[0-9]`, with
   `output_mode: "count"`) -- never from memory of what was written. In `light` mode the spec has no
   `## Scope Boundaries` section: omit those counts instead of reporting zeros.

## Rules

- Never write implementation code in this command -- specify is purely about the "what" and the "why",
  never the "how".
- Responsibilities are split and never swapped: the mode estimate (step 2) is yours and is never
  delegated; the spec content (step 3) is the `spek:spec-writer` subagent's, which writes `spec.md`
  directly and reports only completion -- the content never travels back through you.
- If `.spek/specs/NNN-slug/` already exists, ask whether the user wants to revise the existing spec instead
  of creating a new one. Exception: a directory that has `baseline.md` and no `spec.md` is the normal
  brownfield handoff from `/spek:extract`, not a revision -- proceed without asking and follow the
  brownfield path of step 5.
- Always create `state.json` through `${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh` -- it is the
  only way the plugin knows which phase the feature is in (see the `spek:sdd-templates` skill, file
  `references/conventions.md`), and the script is its single writer so timestamps and counters stay
  real.
