# Execution State Machine

Load this reference when `status` is unhealthy, reports identity warnings, needs migration, or `revisionChanged` is true. Persisted state, not conversation history, controls progress across sessions, models, and agents.

## Contents

- Bootstrap
- Repository identity
- Resume order
- Phases and gates
- Unit statuses
- Repository change handling
- Checkpoints
- Repair and migration
- Source-of-truth hierarchy

## Bootstrap

`BOOT -> INSPECT_WORKSPACE -> INITIALIZE_OR_REPAIR -> VALIDATE_STATE -> RESUME | INITIALIZE_ANALYSIS -> EXECUTE_NEXT_STEP`

| State | Implementation |
|---|---|
| BOOT | Resolve the target repository (SKILL.md, "Running the scripts"). |
| INSPECT_WORKSPACE | `workspace.py status --json`. It never writes and always exits 0, so SKILL.md injects its output for the current directory when the skill loads; run it again for another target repository or when the injected block is not JSON. |
| INITIALIZE_OR_REPAIR | Run `init` only when `next.kind` is `initialize` (after the versioning question) or `repair` with non-empty `missingArtifacts`. `init` creates missing files and never overwrites. |
| VALIDATE_STATE | `status` validates the state schema, consistency (phases, active unit, dependencies, invalidations, checkpoint references), and identity. `validate` adds ledgers, checkpoints, cross-references, and secrets. |
| RESUME | Follow `next` (order below). |
| INITIALIZE_ANALYSIS | `init` records the baseline revision; `next` then points to `reconnaissance`. |
| EXECUTE_NEXT_STEP | One bounded work item persisted through `workspace.py`, then a checkpoint, within the per-invocation budget in SKILL.md. |

## Repository identity

Identity is portable; no absolute path is stored.

1. Root commit (`git rev-list --max-parents=0 HEAD`): different values are an error.
2. Normalized `remote.origin.url` without credentials: when a root commit is missing on either side, different remotes are an error; with matching root commits a different remote is only a warning (fork or mirror).
3. Directory name: a different name is a warning (moved, renamed, cloned, or a worktree).

On an identity error, stop and ask the user. Run `rebaseline --accept-identity` only after the user confirms that the workspace belongs to this repository.

## Resume order

`status.next` implements this order:

1. the active unit;
2. the earliest invalidated unit;
3. the earliest pending unit whose `dependsOn` units are complete;
4. the earliest phase whose status is not `complete`.

Conversation history cannot mark work complete.

## Phases and gates

| # | Phase | SKILL.md section | Script gate on `complete` | Agent responsibility |
|---|---|---|---|---|
| 1 | reconnaissance | Phase 1 | none | scan saved, intent recorded, inventory written |
| 2 | partitioning | Phase 2 | at least one unit | units follow deployables, not folder size |
| 3 | investigation | Phase 3 | every unit complete or blocked | unit completion contract |
| 4 | classification | Phase 4 | every non-blocked unit has reachability | dead-code policy applied |
| 5 | synthesis | Phase 5 | none | conclusions recorded as hypotheses |
| 6 | modeling | Phase 6 | none | DSL validated, or the skip recorded |
| 7 | validation | Phase 7 | `validate` passes | references/validation.md checklist |
| 8 | publication | Phase 8 | every target is `skill_generated`, none is stale, and none has probable secrets or invalid claim labels | references/publication.md |
| - | complete | - | all phases complete | final summary to the user |

Starting (`in_progress`) or completing a phase requires every earlier phase to be complete. Completing a phase moves `currentPhase` to the next phase. Only `invalidate` sets a phase to `invalidated`.

## Unit statuses

`pending`, `in_progress`, `blocked`, `complete`, `invalidated`.

- `in_progress`: only while `currentPhase` is `investigation`, one active unit at a time.
- `complete`: requires a checkpoint and a reachability code; records `analyzedRevision`.
- `blocked`: record the reason in CONCERNS and, when a person can unblock it, an open question.
- `invalidated`: set by `invalidate`; revalidate by moving the unit to `in_progress`, checkpointing, and completing it again.

### Unit completion contract

A unit may be `complete` only when:

- its runtime role and reachability are known or explicitly `uncertain`;
- entrypoints and triggers are investigated;
- inbound and outbound dependencies are investigated;
- data, integration, and deployment evidence is recorded where applicable;
- architecture-changing questions are recorded with `question add`;
- perspective documents are updated;
- a checkpoint exists.

## Repository change handling

A revision change does not invalidate prior knowledge by itself. Changes limited to the workspace or to the skill's published documents are not repository changes: `status`, `invalidate`, and `publish-check` ignore them, so committing the discovery results does not start an update run.

1. `invalidate --json` compares the baseline (or `--since`) with HEAD plus uncommitted paths and invalidates units whose paths changed.
2. Review `dependentsToReview`; invalidate those units with `--unit` when their claims changed.
3. Phases from investigation onward become `invalidated` and `currentPhase` returns to `investigation`.
4. Keep unaffected evidence and units. Evidence about changed files is superseded by new records, never edited.
5. Revalidate, redo synthesis through publication, then `rebaseline`.

Without git, invalidate explicit units only and compare evidence fingerprints.

## Checkpoints

Only `checkpoint write` creates checkpoints: `checkpoints/cp-NNN.json`, validated by `schemas/checkpoint.schema.json`. `lastCheckpoint` holds the id. Each checkpoint records the phase, unit, revision, dirty flag, summary, completed and next actions, and the evidence, hypothesis, and open question ids it relies on.

## Repair and migration

- Malformed or invalid state is preserved and reported; never replace it silently.
- Before any manual edit run `workspace.py backup`; after it run `workspace.py validate`.
- A schemaVersion 1 workspace needs `workspace.py migrate`: it backs up, converts units (legacy `scope` becomes `paths`), invalidations, and unresolved questions, and recreates missing artifacts. Review its `warnings`.
- Exit 5 from `init` about missing templates means the skill installation is broken: reinstall the skill instead of editing the workspace.

## Source-of-truth hierarchy

- workflow progress: `state.json`;
- architecture truth: repository evidence plus confirmations in the ledgers;
- resumable detail: checkpoints and perspective documents;
- conversation: temporary interaction context only.
