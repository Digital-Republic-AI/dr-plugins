---
description: Verifies whether the implementation meets the spec's success criteria and the constitution's principles
argument-hint: "[NNN-slug of the feature, or empty to use the most recent feature]"
allowed-tools: Read, Bash, Glob, Grep, Task
---

# Verify

## Steps

1. Resolve the target feature. Confirm that `state.json` indicates `"phase": "implement-complete"`
   (or that all the tasks in `tasks.md` are marked `[x]`); otherwise, warn that there is pending work
   before verifying.

2. Delegate the verification to the `spek:verifier` subagent, invoking it ONCE. The subagent writes
   `.spek/specs/NNN-slug/verify-report.md` itself (it has the `Write` tool) and returns only a short
   completion notice -- the report path, the verdict (every FR/SC/PR met, or not) and any problem
   it hit. It must NEVER return the report content to you, and you must NEVER write or rewrite
   report content yourself. Pass it the target report path and the PATHS (never the contents) of
   `spec.md`, `.spek/constitution.md` (if it exists) and `tasks.md` (if it exists); the subagent
   reads them and cross-checks:
   - The "Success Criteria" (`SC-00X`) of `spec.md`
   - The "Functional Requirements" (`FR-00X`) of `spec.md`
   - The "What Must Be Preserved" entries (`PR-00X`) under `## Scope Boundaries` of `spec.md`, each
     checked with the same rigor as an `FR`/`SC`: concrete evidence (file:line or test output) that
     the existing behavior still exists and still passes. If `spec.md` has no `## Scope Boundaries`
     section (a spec written before the section existed, or a light-mode spec), skip the `PR` check
     without failing the verification.
   - The principles of `.spek/constitution.md`
   - The actual state of the code (created/modified files, existing tests)

   If `.spek/specs/NNN-slug/baseline.md` exists (produced by `/spek:extract`), pass its path to the
   subagent as a **second verification target**: the numbered `BR-00X` entries recording how the code behaved BEFORE
   the change. The subagent must also cross-reference the `### What Changes` zone of `spec.md`, so that
   a behavior the spec deliberately changed is not read as a regression. If there is no `baseline.md`
   (a greenfield feature), skip this second target silently -- do not mention it in the report and do
   not treat its absence as a problem.

3. The subagent runs the project's test suite if there is an identifiable test command
   (`package.json` scripts, `Makefile`, `pytest`, etc.) and records the result in the report as
   aggregate evidence. Do not run the suite yourself as well -- one run, captured by the agent that
   writes the report.

4. The report the subagent writes at `.spek/specs/NNN-slug/verify-report.md` has a table: each
   `FR`/`SC`/`PR` of the spec, status (Met / Partially Met / Not Met), and evidence (file:line or
   test output). The `PR` rows appear only when the spec has a `## Scope Boundaries` section with
   `### What Must Be Preserved` entries. After the subagent reports completion, confirm the file
   exists (`Glob` on the path, or `Read` of its first lines); if it is missing, stop and report
   the failure -- never fill the gap by writing the report yourself. Take the verdict from the
   file, not from memory of the notice: `Grep` the report for `Partially Met` and `Not Met`
   (`output_mode: "count"`); zero matches in the FR/SC/PR table means everything is met.

   When a `baseline.md` was verified, the report also gains a `## Baseline Preservation` section with
   its own table -- one row per `BR-00X` entry, with the status and the evidence:

   - **Preserved** -- the recorded behavior still holds in the current code.
   - **Changed (intentional)** -- the behavior changed and the spec's `### What Changes` zone says it
     should have; the evidence points to the corresponding What Changes entry.
   - **Possibly Regressed** -- the behavior changed with no corresponding entry in `### What Changes`.
   - **Cannot Assess** -- the `BR` entry carries `[CANNOT INFER]` gaps, so the original behavior was
     never fully established and cannot be compared.

5. If everything is met, run `${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh .spek/specs/NNN-slug set-phase verified`
   (never hand-edit `state.json`) and suggest archiving the feature. If there are items not met,
   list them as next steps and do NOT run the script -- the feature stays unverified. Only the
   `FR`/`SC`/`PR` results decide this; the `## Baseline Preservation` rows never do.

## Rules

- Verify is always based on concrete evidence (file, line, command output) -- never on the subjective
  claim that it "looks correct".
- Never mark a criterion as met if the evidence was not actually inspected in this run.
- Baseline findings are **advisory, never a gate**. A `Possibly Regressed` row does not block the phase
  transition to `verified`, does not turn any `FR`/`SC`/`PR` into "not met", and never changes the
  verification outcome. The `FR`/`SC`/`PR` gate behaves exactly as it did before baselines existed.
- Advisory does not mean quiet: list every `Possibly Regressed` row prominently in the report, and make
  the final summary call them out explicitly ("N baseline behaviors possibly regressed -- review before
  merging") so the human can decide. Never soften or omit a finding to keep the report clean.
- `Cannot Assess` rows are reported as such and never guessed into `Preserved`.
