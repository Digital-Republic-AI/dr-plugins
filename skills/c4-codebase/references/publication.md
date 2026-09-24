# Publication

Publication is the only phase that writes outside the workspace. It never overwrites files the skill did not generate.

## Contents

- Preconditions
- Protect existing content
- Write the documents
- Transformation rules
- Language
- Finish

## Preconditions

- The `validation` phase is complete.
- The output directory is `output.directory` in `state.json` (default `docs/architecture`). Change it with `workspace.py output set --repo . --dir <dir> --json`.

## Protect existing content

Run `${CLAUDE_SKILL_DIR}/scripts/workspace.py publish-check --repo . --json`.

| Target status | Meaning | Action |
|---|---|---|
| `absent` | the file does not exist | write it |
| `skill_generated` | the first lines carry `c4-codebase:generated` | overwrite it |
| `skill_template` | a template marker was never replaced | overwrite it |
| `foreign` | the file exists without a skill marker, so a person maintains it | never overwrite without explicit confirmation |

Files in `otherFiles` (ADRs, images, notes) are never modified or deleted.

Exit 4 means at least one target is foreign. Stop and ask the user to choose:

1. publish into another directory with `output set --dir` (recommended, for example `docs/c4-codebase`);
2. overwrite the named foreign files, after the user confirms they are committed or backed up;
3. do not publish.

Record the decision with `question add --impact scope` and `question answer`.

## Write the documents

Targets: `README.md`, `STACK.md`, `STRUCTURE.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `INTEGRATIONS.md`, `TESTING.md`, `CONCERNS.md`, `workspace.dsl`.

1. The first line of every Markdown target is `headers.markdown` from publish-check; the first line of `workspace.dsl` is `headers.dsl`.
2. Build `README.md` from `templates/README.md`: repository name, scope, analyzed revision and whether uncommitted changes were present, generation time, versioning policy, views, rendering command, main intent-vs-reality divergences, and open questions.
3. Each `perspectives/<name>.md` becomes `<NAME>.md` following the transformation rules.
4. `workspace.dsl` is `model/workspace.dsl` with the template marker replaced by the generated header. Validate the published file as described in `references/structurizr-dsl.md`.

## Transformation rules

- Remove template comments and the template marker.
- Keep claim labels next to their claims. With `versioning: shared`, keep ledger ids (`[observed ev-012]`, `[inferred hyp-004 medium]`, `[confirmed q-003]`). With `versioning: local` the ledgers are not committed, so replace evidence ids with `path:lines` (`[observed src/api/server.ts:12-38]`), hypothesis ids with the confidence (`[inferred, medium]`), and question ids with `[confirmed by the team]`. `publish-check` reports unknown or mismatched ids, ledger ids under `local` versioning, and leftover `000` placeholders in `claimLabelErrors`.
- Turn `[TODO]` into an explicit unknown: "Unknown: <what could not be established>".
- List unresolved `[ASK USER q-NNN]` items in the document's "Open questions" section with the question text, and the id when shared.
- Write answered questions as confirmed statements.
- Keep in the Evidence section the key paths and commands a reader needs; the full ledger stays in the workspace.
- State the confidence of medium-confidence claims in the text, because diagram exporters drop the dashed `Inferred` style.
- Never include secret values; `publish-check` reports probable secrets in `secretFindings`.

## Language

- Working documents, ledgers, labels, ids, markers, and DSL identifiers: English.
- Published Markdown headings and prose: the language the user requested, otherwise the conversation language.
- DSL element names, descriptions, and view titles: the published language; identifiers stay in English camelCase.

## Finish

1. Rerun `publish-check`: every target is `skill_generated`, and `staleFiles`, `secretFindings`, and `claimLabelErrors` are empty. A file is stale when repository content outside the workspace and the published documents changed after the revision in its header; regenerate it with the current header. The publication gate enforces these conditions.
2. `workspace.py phase set --repo . --phase publication --status complete --json`.
3. `workspace.py phase set --repo . --phase complete --status complete --json`.
4. Tell the user where the documents are, which questions remain open, and, with `shared` versioning, that `.c4-codebase/` should be committed together with the documents. Do not commit, stage, or push anything unless the user asks.

## Diagram report

Derived output, generated only after the publication gate passes and only when a Structurizr runner and a PlantUML runner exist (SKILL.md, "Diagram report").

- `export-diagrams.sh --svg` renders the published `workspace.dsl`; the `.puml` and `.svg` files land in `<output dir>/diagrams/`.
- `.c4-codebase/report.json` is the agent's manifest (`schemas/report.schema.json`). Descriptions are for a reader who has not read the Markdown documents: what the view answers, where to look first, what is inferred rather than observed, and what is still unknown. Never paste claim labels or ids into the report; link the Markdown documents under `documents` instead.
- The `intro` opens the page in its own panel and carries four paragraphs. The first is the opening line, set in the display face: one sentence of at most twenty words saying what the system does, one a newcomer can quote. The second says what the system is: its main runtime pieces, its data, and the external services it depends on. The third says how the diagrams were made (from the code, configuration and build at the analyzed revision, not from design documents) and names what was left out because the code does not do it yet. The fourth tells the reader how to use the page: the order of the views (context, containers, components, dynamic), how inferred elements and unknowns are shown, that diagrams are derived outputs, and which Markdown documents to open for evidence and open questions. Set `labels.intro` to the heading of that panel in the published language.
- `render-report.py` writes `<output dir>/diagrams/index.html` from `templates/report.html`, with the generated marker in the second line. The documents under `documents` are embedded in the page: Markdown is converted by the skill's own converter (headings, paragraphs, lists, tables, code, quotes, links, emphasis; claim labels become styled chips; the first heading is replaced by the manifest title), other text files become code blocks. Browsers refuse to load sibling files from a page opened from disk, so embedding at generation time is the only way the documents can be read inside the page; list them in reading order, README first. It exits 4 on a page without the marker, and 2 when an `.svg` has no manifest entry or an entry has no `.svg`; legends (`*-key.svg`) are attached automatically.
- `publish-check` lists `diagrams/` under other files; the page and the SVGs are not publication targets and never block the gate. Regenerate them after each republication so the revision in the page header matches the documents.
