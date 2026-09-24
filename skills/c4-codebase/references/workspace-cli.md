# Script Reference

Run every script directly from the target repository root as `${CLAUDE_SKILL_DIR}/scripts/<script> ...`, one script per Bash invocation, without chaining. Use `python3 <script>` or `bash <script>` only when direct execution is unavailable. Every `workspace.py` command accepts `--repo`, `--scope`, `--workspace`, `--json`, and `--quiet`; `--help` works at every level and `--version` prints the skill version.

`--quiet` prints only the id of the record the command created or revised, one per line, and nothing else on success; it overrides `--json`. Errors keep their exit code and message (JSON on stdout when `--json` is also present, always on stderr).

## Contents

- Exit codes
- workspace.py lifecycle
- workspace.py progress
- workspace.py ledgers
- Responses
- workspace.py maintenance and publication
- scan.py
- export-diagrams.sh
- dsl.py
- render-report.py

## Exit codes

| Code | Meaning | Agent action |
|---|---|---|
| 0 | success | continue |
| 1 | unexpected internal error (traceback) | stop and report the traceback |
| 2 | invalid usage or rejected input: unknown id, missing path, invalid record, probable secret | fix the command using `error` and `hint` |
| 3 | workspace, state, ledger, or phase gate not satisfied | repair what `error` names, then retry |
| 4 | publication blocked by foreign files | ask the user (references/publication.md) |
| 5 | operational error: filesystem, permissions, missing skill files or tooling | follow `hint`; for a read-only repository use `init --external` |

With `--json`, failures print `{"error", "hint", "exitCode"}` on stdout and repeat the message on stderr.

## workspace.py lifecycle

| Command | Behavior |
|---|---|
| `status` | Health, identity, revisions, uncommitted paths, artifacts, and `next` (`initialize`, `migrate`, `repair`, `unit`, `phase`, `none`). `revisionChanged` and `dirty` ignore changes limited to the workspace and the skill's published documents. Never writes. |
| `check` | Same report; exit 3 when unhealthy. |
| `init [--versioning shared\|local] [--output-dir DIR] [--external]` | Creates missing artifacts only; loads templates before creating anything. Options are ignored, with a warning, when state already exists. |
| `validate` | State schema and consistency, ledgers, checkpoints, cross-references, reachability codes inside whole-scope units, secret patterns in ledgers, checkpoints, working documents, and published documents, claim labels against ledger ids, questions.md freshness, and the offline lint of `model/workspace.dsl` (`errors.dsl`, lint warnings in `warnings`). Exit 3 on any error; label status mismatches are warnings. |
| `migrate` | Backs up, converts a schemaVersion 1 state, moves the legacy questions.md to questions.legacy.md, and recreates missing artifacts. |
| `backup` | Copies state, ledgers, questions, inventory, checkpoints, perspectives, and model into `backups/<UTC timestamp>/`. |

## workspace.py progress

| Command | Rules enforced |
|---|---|
| `phase set --phase P --status S` | Starting or completing P requires every earlier phase complete. Completing a phase advances `currentPhase`. Gates: partitioning needs a unit and warns about whole-scope units; investigation needs every unit complete or blocked; classification needs reachability on every non-blocked unit; validation needs `validate` to pass; publication needs every target `skill_generated` and empty `staleFiles`, `secretFindings`, and `claimLabelErrors`. `--phase complete --status complete` needs all phases complete. |
| `unit add --id ID --path P... --type T [--depends-on ID...] [--description TEXT]` | Unique kebab-case id; paths exist; dependencies exist. |
| `unit set --id ID [--status S] [--reachability R] [--description TEXT]` | `in_progress` only during investigation, one active unit at a time; `complete` needs a checkpoint and a reachability code and records `analyzedRevision`. |
| `checkpoint write --summary TEXT [--phase P] [--unit ID] [--completed A...] [--next A...] [--evidence ID...] [--hypothesis ID...] [--question ID...]` | Referenced ids must exist. Writes `checkpoints/cp-NNN.json`, sets `lastCheckpoint`, links the unit. |

## workspace.py ledgers

| Command | Behavior |
|---|---|
| `evidence add --kind K --observation TEXT [--path P] [--lines L] [--command C] [--unit ID] [--intent] [--question-id Q] [--supersedes EV]` | Fills id, revision, dirty flag, fingerprint, and timestamp. Paths of source, config, deployment, and documentation evidence must exist. |
| `evidence add-batch --file PATH` | Appends every record of a JSONL file in one call. Each line is an object with the fields of `evidence add` in camelCase: `kind`, `observation` (both required), `path`, `lines`, `command`, `unit`, `intent` (boolean), `questionId`, `supersedes`. Every line is validated first (fields, paths, units, ids, secrets, schema); when any line fails, nothing is appended and the error names each failing line. `supersedes` must name an id already in the ledger, not one from the same batch. |
| `hypothesis add --claim TEXT --evidence EV... --confidence C [--status S] [--unit ID] [--reachability R] [--question-id Q...] [--supersedes HYP]` | At least one evidence id. `--reachability` is required for a hypothesis of a unit whose path is `.` or the scope, and for a hypothesis without a unit while such a unit exists. |
| `hypothesis revise --id HYP [--status S] [--confidence C] [--reachability R] [--evidence EV...] [--question-id Q...]` | Appends a revision with the same id and claim. |
| `question add --question TEXT --impact I [--unit ID] [--hypothesis HYP...] [--supersedes Q]` | Appends an open question and renders questions.md. |
| `question answer --id Q --answer TEXT` | Appends `user_confirmation` evidence and the answered revision. |
| `question dismiss --id Q --reason TEXT` | Appends the dismissed revision. |
| `question render` | Regenerates questions.md. |

Repeatable options also accept comma-separated values. Every text input is checked for probable secrets.

## Responses

With `--json`, every mutation returns the record it wrote under a key named after the record kind, plus context. Read ids from these keys; there is no generic `record` key.

| Command | Keys | Example (abridged) |
|---|---|---|
| `evidence add` | `evidence` | `{"evidence": {"id": "ev-001", "kind": "source", "path": "services/api/main.py", "lines": "1", "observation": "...", "unit": "api", "repositoryRevision": "<sha>", "dirty": false, "fingerprint": "71ecf9c88e45c759", "capturedAt": "..."}}` |
| `evidence add-batch` | `evidence` (list), `count` | `{"evidence": [{"id": "ev-002", ...}, {"id": "ev-003", ...}], "count": 2}` |
| `hypothesis add`, `hypothesis revise` | `hypothesis` | `{"hypothesis": {"id": "hyp-001", "claim": "...", "evidence": ["ev-001"], "confidence": "high", "status": "inferred", "unit": "api", "reachability": null, "questionIds": [], "recordedAt": "..."}}` |
| `question add`, `question dismiss` | `question`, `openQuestions` | `{"question": {"id": "q-001", "question": "...", "impact": "system_boundary", "status": "open", "unit": "api", "hypothesisIds": ["hyp-001"], "answer": null, ...}, "openQuestions": 1}` |
| `question answer` | `question`, `openQuestions`, `evidence` | `{"question": {"id": "q-001", "status": "answered", "answer": "...", "answerEvidence": "ev-004", ...}, "openQuestions": 0, "evidence": {"id": "ev-004", "kind": "user_confirmation", "questionId": "q-001", ...}}` |
| `checkpoint write` | `checkpoint`, `next` | `{"checkpoint": {"id": "cp-001", "phase": "investigation", "unit": "api", "summary": "...", "evidenceIds": ["ev-001"], "hypothesisIds": ["hyp-001"], "openQuestionIds": [], ...}, "next": {...}}` |
| `unit add`, `unit set` | `unit`, `next` (`unit set` adds `activeUnit`) | `{"unit": {"id": "api", "paths": ["services/api"], "type": "service", "status": "in_progress", "reachability": null, "dependsOn": [], "checkpointIds": []}, "activeUnit": "api", "next": {...}}` |
| `phase set` | `phase`, `status`, `currentPhase`, `warnings`, `next` | `{"phase": "reconnaissance", "status": "complete", "currentPhase": "partitioning", "warnings": [], "next": {"kind": "phase", "id": "partitioning", "reason": "..."}}` |
| any failure | `error`, `hint`, `exitCode` | `{"error": "path does not exist in the working tree: missing.py", "hint": "use --kind git for files that only exist in history", "exitCode": 2}` |

`next` always has `kind` (`initialize`, `migrate`, `repair`, `unit`, `phase`, `none`), `id`, and `reason`. With `--quiet` the same commands print only `ev-001`, `hyp-001`, `q-001`, `cp-001`, or the unit id, one per line.

## workspace.py maintenance and publication

| Command | Behavior |
|---|---|
| `invalidate [--since REV] [--unit ID...] [--reason TEXT]` | Default `--since` is the baseline. Changed paths include uncommitted files and exclude the workspace and the skill's published documents. Pending units are skipped. Downstream phases become `invalidated` and `currentPhase` returns to investigation. Returns `dependentsToReview`. |
| `rebaseline [--force] [--accept-identity]` | Records the current revision and identity. Refuses while units are invalidated. Use `--accept-identity` only after the user confirms an identity change. |
| `output set --dir DIR` | Changes the publication directory and returns the publish-check report. |
| `publish-check [--output-dir DIR]` | Classifies targets (`absent`, `skill_generated`, `skill_template`, `foreign`), lists other files, and returns the header lines. For the skill's targets it reports `staleFiles` (the header revision is followed by changes outside the workspace and the published documents), `secretFindings`, `claimLabelErrors`, `claimLabelWarnings`, and the offline lint of the published `workspace.dsl` (`dslLintErrors`, `dslLintWarnings`). Exit 4 when blocked. |

## scan.py

`scan.py --repo . --save` writes `scan.json` and `scan.md` into the resolved workspace and prints a short summary. Other options: `--scope PATH`, `--workspace DIR`, `--json-output PATH`, `--md-output PATH`, `--stdout json|markdown`, `--max-files N`. Output keys are described in `references/repository-reconnaissance.md`.

## export-diagrams.sh

`export-diagrams.sh [--workspace PATH] [--format FORMAT] [--output DIR] [--validate-only] [--svg]`. Runner selection, defaults, and exit codes are in `references/structurizr-dsl.md`. `--svg` renders the exported `.puml` files to `.svg` with PlantUML and needs a PlantUML runner.

## dsl.py

`dsl.py lint --workspace PATH [--json]` checks a DSL file offline against the subset in `references/structurizr-dsl.md`; exit 3 on errors, 5 when the file is missing. The JSON report is `{"path", "valid", "errors", "warnings", "counts"}`.

`dsl.py export --workspace PATH --format dot|mermaid [--output DIR] [--render] [--json]` writes `structurizr-<view key>.dot` or `.mmd` per view into `DIR` (default `<DSL directory>/diagrams`) and refuses a file with lint errors (exit 3, nothing written). `--render` needs the Graphviz `dot` binary and applies to `dot` only; it writes `structurizr-<view key>.svg` next to each file (exit 5 without the binary). The JSON summary is `{"workspace", "format", "output", "written", "rendered", "warnings"}`.

## render-report.py

`render-report.py --diagrams DIR --manifest FILE [--output FILE] [--json]` builds one HTML page with every `.svg` of `DIR` inline, using `templates/report.html`. The manifest follows `schemas/report.schema.json`:

```json
{
  "title": "Reciclare Support AI",
  "lang": "pt-BR",
  "repository": "reciclare-support-ai",
  "revision": "e3ebe0950d25a8cf8db4d14d473206336549e797",
  "intro": "Um parágrafo.\n\nOutro parágrafo.",
  "diagrams": [
    {"file": "structurizr-1-SupportAiContext.svg", "title": "Contexto", "description": "O que a visão mostra.\n\nO que é inferido."}
  ],
  "documents": [{"file": "../ARCHITECTURE.md", "title": "Arquitetura"}],
  "labels": {"kicker": "Diagramas de arquitetura", "diagrams": "Diagramas", "documents": "Documentos", "fit": "Ajustar à largura", "actual": "Tamanho real", "fullscreen": "Tela cheia", "download": "Baixar SVG", "legend": "Legenda", "skip": "Ir para o conteúdo", "repository": "Repositório", "revision": "Revisão", "generated": "Gerado em", "footer": "Gerado pela skill c4-codebase a partir do modelo Structurizr DSL do repositório."}
}
```

Text fields are plain text; blank lines separate paragraphs, and everything is HTML-escaped. `labels` and `lang` default to English. Every `.svg` in `DIR` except `*-key.svg` needs an entry, and every entry needs its file (exit 2). `documents[].file` is relative to `DIR`; each file must exist (exit 2) and is embedded in the page, Markdown converted to HTML and any other text file as a code block. The default output is `DIR/index.html`; an existing file without the `c4-codebase:generated` marker is never overwritten (exit 4). With `--json` the summary is `{"written", "diagrams", "legends", "documents"}`.
