---
name: c4-codebase
description: Reverse-engineers an existing codebase into evidence-backed architecture documentation and a canonical C4 Structurizr DSL model, keeping resumable state in .c4-codebase/ and publishing to docs/architecture/. Use when the user asks to map, document, diagram, or reverse-engineer the architecture of a repository or monorepo, generate C4 or Structurizr diagrams from code, map the integrations and runtime topology of a legacy or poorly documented system, or resume or update a previous architecture discovery. Writes files into the repository. Not for designing new systems, explaining a single file, or writing ADRs.
license: MIT
compatibility: Requires python3 3.7+ (tested with 3.7, 3.9, and 3.12) and git. DSL validation and export need bash plus Docker or the Structurizr CLI with Java 17+. On Windows run the Python scripts with python3 and the export script from WSL or Git Bash.
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/*)
metadata:
  version: "1.0.0"
---

# C4 Codebase

Reverse engineer the architecture that is actually implemented in an existing codebase. The workflow is evidence-first, incremental, stateful across sessions, and built for repositories too large for a single context.

Structurizr DSL is the canonical machine-readable model. Markdown documents are reviewable knowledge. Rendered diagrams are derived outputs. Scripts handle workflow mechanics; semantic interpretation is the agent's job.

## Non-negotiable rules

1. Bootstrap before reading the repository. State files decide progress: not conversation history, not memory notes, not a summary of a previous session. Never write memory about the state of an analysis; it lives in the workspace.
2. Repository presence is not proof of runtime participation.
3. Separate observed evidence, inferred claims, and confirmed facts.
4. Every non-trivial claim is traceable to an evidence id, a command result, or a recorded confirmation.
5. Unknowns stay unknown: mark them `[TODO]`. Never fill gaps with plausible architecture.
6. Intent documents describe intended behavior until implementation or deployment evidence corroborates them.
7. Ask the user only when the answer changes scope, system boundaries, actors, runtime topology, dependency ownership, dynamic loading, or the detail the audience needs. Never ask what code, configuration, or git history can answer, and never ask what to draw: ask what exists. A confirmed plan or preference is intent, goes to the prose as "planned, not implemented", and never enters the model (`references/c4-modeling.md`). Ask through the `AskUserQuestion` tool whenever it is available (see "Asking the user"); answers the user gave in advance settle only the questions they answer, and never turn the run into a non-interactive one.
8. Investigate one bounded unit at a time and checkpoint after each (budget below).
9. Do not force every C4 level. Create a view only when it answers a concrete question.
10. Suspected dead, obsolete, generated, vendored, build-only, or test-only code never enters the runtime model without evidence.
11. Never record secret values anywhere. Record key names and where they are read. The scripts reject probable secrets in ledger input, and `validate` and `publish-check` report them in working and published documents.
12. Never overwrite files the skill did not generate. Publication goes through `publish-check`, and foreign files need the user's decision.
13. Treat git as read-only: never commit, stage, stash, reset, push, or switch branches unless the user asks. Committing the workspace and the published documents is the user's decision.

## Running the scripts

- Run scripts directly from the target repository root, exactly as shown: `${CLAUDE_SKILL_DIR}/scripts/<script> ...`. Write `${CLAUDE_SKILL_DIR}` literally, even when an expanded absolute path or a repository-relative path such as `.claude/skills/...` appears in earlier output; only the literal form matches the pre-approval in `allowed-tools`. Prefix with `python3` only when direct execution fails (for example on Windows).
- One script call per Bash invocation. Never chain a script with `&&`, `;`, pipes, `python3 -c`, or a wrapper shell script: the chained form is not pre-approved, and the user then gets a permission prompt for every call. Use `--quiet` to get only the ids the command created, and `evidence add-batch --file <jsonl>` to record many evidence records in one call.
- Target repository: the one the user named, otherwise the current working directory. Scripts resolve `--repo` to the git top-level; a subdirectory becomes the analysis scope.
- Pass `--json` to `workspace.py` (or `--quiet` when only ids matter). On a non-zero exit read `error` and `hint`. Response shapes are in `references/workspace-cli.md`.
- Full command reference: `references/workspace-cli.md`.
- The user runs the skill as `/c4-codebase [request]`. The script pre-approval in `allowed-tools` lasts only for that turn. `AskUserQuestion` pauses inside the turn, so the pre-approval survives its answers; whenever you do end the turn for the user (budget reached, text fallback for questions, publication decision without the tool), tell them to reply with `/c4-codebase` followed by their answers, or alone to continue, rather than with a plain message.
- On the first run, tell the user that the `acceptEdits` permission mode avoids a prompt for every file the skill writes.

| Exit | Meaning |
|---|---|
| 0 | success |
| 1 | unexpected internal error: stop and report it |
| 2 | invalid usage or rejected input (unknown id, missing path, probable secret) |
| 3 | workspace, state, ledger, or phase gate not satisfied |
| 4 | publication blocked by foreign files |
| 5 | operational error (permissions, missing skill files, missing tooling) |

## Bootstrap (every invocation)

Workspace status of the current directory, captured when this skill was loaded:

!`${CLAUDE_SKILL_DIR}/scripts/workspace.py status --repo . --json`

If the block above is not JSON (the command did not run in this environment), or the target repository is not the current directory, run it yourself:

```bash
${CLAUDE_SKILL_DIR}/scripts/workspace.py status --repo <repo> --json
```

Act on `next.kind`:

| `next.kind` | Action |
|---|---|
| `initialize` | First run. Ask one question with `AskUserQuestion` (options `shared` and `local`), unless the prompt already answers it: commit the workspace (`shared`, recommended: state, ledgers, checkpoints, perspectives, and model are versioned; scan output and backups are ignored) or keep it local (`local`). Then run `${CLAUDE_SKILL_DIR}/scripts/workspace.py init --repo . --versioning <choice> --json`. If the repository is not writable or the user does not want files in it, add `--external` and tell the user where the workspace lives. |
| `migrate` | Run `workspace.py migrate --repo . --json` (it backs up first), review `warnings`, then rerun status. |
| `repair` | Non-empty `missingArtifacts`: run `init` (it never overwrites). `stateErrors`: load `references/state-machine.md`. An identity error means another repository: stop and ask. |
| `unit` or `phase` | Resume that unit or phase. |
| `none` | The analysis is complete. Offer an update run instead of starting over. |

If `revisionChanged` or `dirty` is true, follow "Repository changes" before resuming. Load `references/state-machine.md` and `references/workspace-management.md` only when status is unhealthy, reports identity warnings, needs migration, or the revision changed.

## Asking the user

- Use the `AskUserQuestion` tool whenever it is available: one call per batch of up to four questions, each with two to four options, in the published language. Turn each open question of the ledger into one tool question whose options are the competing hypotheses, so the chosen option maps to `question answer`; "Other" covers free text. A batch of more than four questions takes two calls.
- The tool pauses the turn and the script pre-approval survives, so continue in the same turn after the answers.
- Fall back to a numbered list in text only when the tool is unavailable (for example `claude -p`). Then end the turn and tell the user to answer with `/c4-codebase 1. ... 2. ...`.
- Answers given in the prompt (versioning, a topology, a boundary) settle only what they say. They do not mean that nobody can answer: still ask the remaining questions. Skip the batch only when the user said nobody can answer, and then publish the questions as open.
- Never move to publication while a question is open unless the user said nobody can answer.

## Workflow

Phases tracked in `state.json`: `reconnaissance -> partitioning -> investigation -> classification -> synthesis -> modeling -> validation -> publication -> complete`. Move them with `workspace.py phase set --repo . --phase <phase> --status in_progress|complete --json`. The script enforces order and completion gates.

Copy this checklist into your working notes and tick items as gates pass:

```text
- [ ] 1 reconnaissance: scan saved, intent recorded, inventory.md written
- [ ] 2 partitioning: units registered with paths, types, dependencies
- [ ] 3 investigation: every unit complete or blocked, each with a checkpoint
- [ ] 4 classification: every unit has a reachability code
- [ ] 5 synthesis: C4 candidates recorded as hypotheses with confidence
- [ ] 6 modeling: model/workspace.dsl written, DSL validation recorded
- [ ] 7 validation: workspace.py validate exits 0, checklist reviewed
- [ ] 8 publication: publish-check clean, every target generated
- [ ] complete
```

### Per-invocation budget

Complete at most 3 units, or read about 150 source files, per invocation, whichever comes first. Then write a checkpoint, give the user a short summary (units done and remaining, open questions, and how to resume with `/c4-codebase`), and stop unless the user asks to continue. Ask whether to continue with `AskUserQuestion` when it is available, so the pre-approval survives. Small repositories usually finish in one invocation.

### Phase 1: Reconnaissance

```bash
${CLAUDE_SKILL_DIR}/scripts/scan.py --repo . --save
```

Read `scan.md` in the workspace. Check `truncated`, `walkErrors`, `excludedDirectories`, and `warnings` before concluding that something does not exist. Read `intentDocuments` and `apiSpecifications` before source code and record them with `evidence add --kind documentation --intent`. Write `inventory.md`. Load `references/repository-reconnaissance.md`; add `references/stack-detection.md` when stacks are ambiguous.

### Phase 2: Scope and partitioning

Decide what the repository represents: product, subsystem, service, library, infrastructure, monorepo, or partial implementation. Register investigation units, preferring deployables, services, workers, serverless groups, infrastructure areas, and major shared packages over arbitrary folders:

```bash
${CLAUDE_SKILL_DIR}/scripts/workspace.py unit add --repo . --id api --path services/api --type service --json
```

### Phase 3: Progressive investigation

For the unit in `next`:

1. `unit set --id <unit> --status in_progress`.
2. Answer `references/inquiry-checkpoints.md`, using `references/architecture-investigation.md` for runtime and pattern analysis.
3. Record facts as they appear: `evidence add` (or `evidence add-batch --file` for a set of observations gathered together), then `hypothesis add` for conclusions, and `question add` for gaps only a person can close.
4. Update the perspectives in the workspace (`perspectives/*.md`) incrementally.
5. `checkpoint write --unit <unit> --summary ...`.
6. `unit set --id <unit> --status complete --reachability <code>`, or `--status blocked` with the reason in CONCERNS.

### Phase 4: Reachability classification

Classify every unit and architecture-relevant area with exactly one code: `active`, `likely_active`, `uncertain`, `test_build_tooling`, `generated_vendor`, `suspected_dead`, `obsolete_confirmed`. Apply `references/dead-code-handling.md`. Never omit or promote uncertain code silently.

A unit whose path is the repository root (`.`) or the whole scope cannot tell its areas apart. Give each architecture-relevant area inside it (plugin directories, legacy folders, generated or vendored code) its own hypothesis with evidence and `--reachability`. While such a unit exists, `hypothesis add` requires `--reachability` for hypotheses of that unit or without a unit, and `validate` reports existing ones; fix them with `hypothesis revise --id <hyp> --reachability <code>`.

### Phase 5: Architecture synthesis

Synthesize bottom-up from evidence: runtime units become candidate Containers, cohesive responsibilities become Components, ownership and runtime boundaries become Software Systems, external dependencies and roles become external systems and People, observed flows become relationships with direction, purpose, and known technology. Record each conclusion as a hypothesis. Report patterns only with structural evidence; hybrids and violations are valid findings. Load `references/c4-modeling.md`, which holds the uncertainty table: `high` or confirmed claims enter the model, `medium` claims enter tagged `Inferred`, `low` or `uncertain` claims stay out of the DSL.

### Phase 6: Modeling

Edit `model/workspace.dsl` in the workspace, keeping identifiers stable across runs. Load `references/structurizr-dsl.md`, starting from `examples/workspace.dsl` for syntax. Validate and record the result as command evidence:

```bash
${CLAUDE_SKILL_DIR}/scripts/export-diagrams.sh --workspace .c4-codebase/model/workspace.dsl --validate-only
```

Before that, run the offline lint, which needs no runner and covers the subset the template uses (identifiers, relationships, views, dynamic steps, deployment instances, tags, styles): `${CLAUDE_SKILL_DIR}/scripts/dsl.py lint --workspace .c4-codebase/model/workspace.dsl --json`. Fix every error; `validate` repeats the lint and fails on the same errors. The lint is a first barrier, not the Structurizr parser: a model that passes it is "lint ok", never "validated", until the CLI ran.

Exit 5 from the export script means no runner is available (Docker daemon, `structurizr.sh`, or `STRUCTURIZR_CLI` with Java 17+). Record that the model passed the lint but was not validated by the CLI, continue, and tell the user in one line at the next stop: which runner would enable validation, and that the skill revalidates on request.

### Phase 7: Validation

Run `${CLAUDE_SKILL_DIR}/scripts/workspace.py validate --repo . --json`, fix every error, and repeat until it exits 0. Besides ledgers and state, it checks reachability codes, secret values in working and published documents, and claim labels against ledger ids. Then review `references/validation.md`. Ask the remaining architecture-changing questions, 3 to 7 in one batch, following "Asking the user" (`AskUserQuestion` in calls of up to four; numbered text only as fallback). Record answers with `question answer`, revise affected hypotheses, regenerate affected artifacts, and validate again. Do not enter publication with open questions unless the user said nobody can answer.

### Phase 8: Publication

Load `references/publication.md` and run `${CLAUDE_SKILL_DIR}/scripts/workspace.py publish-check --repo . --json`. Exit 4 means a target exists without the skill's marker: ask the user with `AskUserQuestion` (options: publish elsewhere with `output set --dir`, overwrite the named files, stop). Write the eight documents and the DSL with the header lines from `headers`, and rerun `publish-check` until `staleFiles`, `secretFindings`, and `claimLabelErrors` are empty. Then complete the `publication` phase, whose gate enforces the same conditions, and mark the analysis `complete`. Do not commit the results; tell the user what to commit. Do not save memory notes about the analysis: the next run bootstraps from the workspace.

### Diagram report (optional)

After the publication gate passes, offer the user a browsable page with the diagrams. It needs a Structurizr runner plus a PlantUML runner (`PLANTUML_JAR`, `plantuml` on PATH, or Docker); without them, skip it and say in one line what would enable it.

1. `${CLAUDE_SKILL_DIR}/scripts/export-diagrams.sh --workspace docs/architecture/workspace.dsl --svg` writes one `.puml` and one `.svg` per view into `docs/architecture/diagrams/`. Without a Structurizr or PlantUML runner but with Graphviz installed, `${CLAUDE_SKILL_DIR}/scripts/dsl.py export --workspace docs/architecture/workspace.dsl --format dot --render` produces the same `.svg` names from the skill's own exporter, with less fidelity.
2. Write `.c4-codebase/report.json` (`schemas/report.schema.json`): `title`, `lang`, `repository`, `revision` (from `headers`), an `intro` of four paragraphs (first: one sentence of at most twenty words saying what the system does, set as the opening line; second: what the system is, its main runtime pieces and dependencies; third: how the diagrams were produced, from which revision, and what was left out because the code does not do it yet; fourth: how to read them, in which order, what inferred elements and unknowns look like, and where the Markdown documents go deeper), one entry per `.svg` with a `title` and a `description` of two to four sentences saying what the view shows, what to look at first, and which elements or relationships are inferred, plus `documents` listing the published Markdown files and `workspace.dsl` (paths relative to the diagrams directory, in reading order, README first) and translated `labels`. Everything in the published language; `*-key.svg` legends attach themselves.
3. `${CLAUDE_SKILL_DIR}/scripts/render-report.py --diagrams docs/architecture/diagrams --manifest .c4-codebase/report.json --json` fills `templates/report.html` and writes `docs/architecture/diagrams/index.html` with the generated marker: the SVGs inline, and every listed document converted from Markdown and embedded after the diagrams (the DSL as a code block), so the page is self-contained and works from a local file. It refuses to overwrite a page without the marker, rejects diagrams the manifest does not describe, and fails on a listed document that does not exist.
4. `${CLAUDE_SKILL_DIR}/scripts/dsl.py export --workspace docs/architecture/workspace.dsl --format mermaid` adds one `.mmd` per view next to the other files, for tools that render Mermaid; the page does not embed them.
5. Tell the user to open `index.html` in a browser. Regenerate everything after every republication, because the header carries the revision.

## Repository changes

Commits and uncommitted edits limited to the workspace or to the published documents the skill generated are not repository changes: `status`, `invalidate`, and `publish-check` ignore them.

When `revisionChanged` or `dirty` is true:

1. `workspace.py invalidate --repo . --json` compares the baseline with HEAD plus uncommitted paths and invalidates units whose paths changed.
2. Review `dependentsToReview`; invalidate them with `--unit` when their claims changed.
3. Revalidate invalidated units, supersede evidence for changed files, and redo downstream phases.
4. `workspace.py rebaseline --repo . --json` once no unit is invalidated.

Evidence captured with `dirty: true` describes uncommitted content; recheck it before publication.

## Claim labels and markers

- `[observed ev-012]`, `[inferred hyp-004 medium]`, `[confirmed q-003]`: written after the claim in working documents. `[confirmed hyp-004]` marks a hypothesis confirmed by authoritative documentation.
- `[TODO]`: an implementation fact not yet established from the repository. Published as an explicit unknown.
- `[ASK USER q-007]`: a gap only a person can close, always backed by a `question add` record.
- Label ids must exist and match the label: `observed` cites `ev-NNN`, `inferred` cites `hyp-NNN`, `confirmed` cites `q-NNN` or `hyp-NNN`, and `ASK USER` cites `q-NNN`. `validate` checks working and published documents, `publish-check` checks published ones, and ids ending in `000` are template placeholders. Published labels follow `references/publication.md`.
- File markers: `c4-codebase:template` in templates and working copies, `c4-codebase:generated` in published files. The scanner excludes marked files from intent documents; `publish-check` treats unmarked targets as foreign.

## Working workspace

`.c4-codebase/` (or the external location reported by `status`) is managed by `workspace.py`:

```text
.c4-codebase/
├── .gitignore
├── state.json
├── evidence.jsonl
├── hypotheses.jsonl
├── questions.jsonl
├── questions.md          rendered from questions.jsonl
├── inventory.md
├── scan.json
├── scan.md
├── checkpoints/
├── model/workspace.dsl
└── perspectives/         stack, structure, architecture, conventions,
                          integrations, testing, concerns (.md)
```

Write ledgers only through `workspace.py`. The evidence model is in `references/evidence-model.md`, and the schemas are under `schemas/`.

## Final outputs

Unless the user narrows the scope or chooses another directory, publish under `docs/architecture/`: `README.md`, `STACK.md`, `STRUCTURE.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `INTEGRATIONS.md`, `TESTING.md`, `CONCERNS.md`, and `workspace.dsl`. The seven perspective documents preserve knowledge beyond the diagrams; `workspace.dsl` is the canonical model. When the runners are available, `diagrams/` holds one `.puml`, `.svg`, and `.mmd` per view and `diagrams/index.html`, the browsable report built from `templates/report.html`.

## Focus-area mode

If the user asks for a limited area, such as "architecture and integrations only":

1. always perform bootstrap and reconnaissance;
2. prioritize the requested perspectives;
3. keep `[TODO]` placeholders and known unknowns in the remaining documents;
4. still validate claims across repository boundaries that affect the requested area.

For a single subdirectory, run the scripts with `--scope <path>`.

## Edge cases

| Situation | Decision |
|---|---|
| Not a git repository | Identity is the directory name; no revisions. Invalidate with `--unit` and compare evidence fingerprints. Mention the limitation in README. |
| No source files (`counts.sourceFiles` is 0) | Report it and confirm the target with the user. A repository with only IaC or docs is an infrastructure or documentation repository; never invent runtime units. |
| Git submodules (`submodules` in the scan) | Model each as an external system unless the user includes it; its content is not scanned. |
| System spread over several repositories | Model this repository's system and show sibling repositories as external systems. Ask once for their names and roles. Use one workspace per repository. |
| Repository too large for one session | Follow the per-invocation budget; partition by deployables; use `--scope` for focused runs. |
| Read-only repository or no consent to write | `init --external`; ask where to publish (`output set --dir`). |

## Bundled resources

Load resources progressively:

- `references/workspace-cli.md`: every script command, option, and exit code;
- `references/state-machine.md`: bootstrap, identity, resume, phase gates, change handling, repair;
- `references/workspace-management.md`: workspace location, versioning, paths, freshness;
- `references/repository-reconnaissance.md`: scan output and repository-first discovery;
- `references/stack-detection.md`: ambiguous stack handling;
- `references/inquiry-checkpoints.md`: investigation questions per perspective and C4 level;
- `references/architecture-investigation.md`: runtime, patterns, layers, data, cross-cutting concerns;
- `references/evidence-model.md`: claims, ledgers, append-only rules, secrets;
- `references/dead-code-handling.md`: reachability codes and their treatment;
- `references/c4-modeling.md`: C4 levels, boundaries, uncertainty table;
- `references/structurizr-dsl.md`: DSL syntax, tags, validation, export;
- `references/validation.md`: executable checks and completion criteria;
- `references/publication.md`: publication safety, transformation, language.

## Output language

Keep the skill, working documents, ledgers, labels, ids, markers, and DSL identifiers in English so any session or model can resume. Write published documents in the language the user requested, otherwise in the conversation language.
