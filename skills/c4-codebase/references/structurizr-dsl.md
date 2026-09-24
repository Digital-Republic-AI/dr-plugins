# Structurizr DSL Conventions

Structurizr DSL is the canonical architecture model for this skill. Language reference: https://docs.structurizr.com/dsl/language

Start from `templates/workspace.dsl`. `examples/workspace.dsl` shows context, container, deployment and dynamic views using every tag below.

## Contents

- Syntax rules
- Modeling conventions
- Tags and styles
- Views
- Working copy and publication
- Validation
- Offline lint and fallback exporters
- Export

## Syntax rules

The DSL is line-oriented, and the parser rejects shortcuts that other languages accept:

- one statement or property per line;
- no `;` separators;
- no single-line blocks such as `element "Person" { shape Person }`;
- an opening brace ends its line and a closing brace stands alone on its line;
- quote tokens that contain spaces; combine tags in one quoted, comma-separated string (`"External,Inferred"`).

```text
styles {
    element "External" {
        background #999999
        color #ffffff
    }
    relationship "Inferred" {
        style dashed
    }
}
```

## Modeling conventions

- use stable camelCase identifiers under `!identifiers hierarchical` (for example `ordering.api`);
- descriptions explain responsibility, not folder location;
- add technology labels and relationship protocols only when evidence supports them;
- relationships state purpose and direction (see `references/c4-modeling.md`);
- prefer `autoLayout` unless a maintained manual layout is intentionally required.

## Tags and styles

| Tag | Applies to | Style |
|---|---|---|
| `External` | people and systems outside the discovery boundary | grey background, white text |
| `Database` | databases and persistent stores | `shape Cylinder` |
| `Queue` | queues, topics and event streams | `shape Pipe` |
| `Inferred` | medium-confidence elements and relationships | element `border dashed`; relationship `style dashed` |

Uncertainty rule (full decision table in `references/c4-modeling.md`):

- `high` or `confirmed`: model the claim normally;
- `medium`: model it with the `Inferred` tag;
- `low` or `uncertain`: keep it out of the DSL; record it in `CONCERNS.md` and in the question ledger.

Structurizr draws relationships dashed by default, so keep the template's `relationship "Relationship"` style with `style solid`; without it `Inferred` relationships look like all others. The `plantuml/c4plantuml` and `mermaid` exporters drop tag styles, so label medium-confidence claims in the Markdown documents as well.

## Views

Create only views justified by the system and audience: `systemLandscape`, `systemContext`, `container`, `component`, `deployment`, `dynamic`.

- Deployment: use `deploymentEnvironment`, `deploymentNode`, `infrastructureNode`, `softwareSystemInstance` and `containerInstance` only with deployment evidence. Define the environment after the relationships; instances created before a relationship do not show it.
- Dynamic: reserve for architecture-significant workflows (checkout, event processing, authentication, ingestion, asynchronous orchestration). Every step must match a relationship already in the model, or validation fails.

## Working copy and publication

- Draft in `.c4-codebase/model/workspace.dsl`, copied from `templates/workspace.dsl` at init. Leave its first line, `// c4-codebase:template`, in place.
- Only the publication phase writes `<output dir>/workspace.dsl` (default `docs/architecture/workspace.dsl`). The published file starts with `// c4-codebase:generated revision=<sha> generatedAt=<iso-8601>` instead of the template marker.
- Marker lines are ordinary `//` comments and are valid as the first line of a workspace.
- Keep identifiers stable across the working copy, earlier publications and reruns, so diffs show architectural change rather than renames.

## Validation

Validation is mandatory whenever tooling exists. From the repository root, validate the working copy before marking modeling complete, and the published file after publication. For an external workspace, use the `workspace.path` reported by `workspace.py status`:

```bash
${CLAUDE_SKILL_DIR}/scripts/export-diagrams.sh --workspace .c4-codebase/model/workspace.dsl --validate-only
```

- Exit `3`: fix the reported line and rerun until exit `0`.
- Exit `5` because neither Docker nor a Java 17 CLI is available: add a `[TODO]` to `CONCERNS.md` stating that DSL validation was skipped.
- Record the outcome (passed, failed or skipped) as command evidence:
  `${CLAUDE_SKILL_DIR}/scripts/workspace.py evidence add --repo . --kind command --command "<command>" --observation "<result>" --json`
- When the script exits 5 because no runner is available, do not stop, but do not stay silent either: at the next stop tell the user in one line that the model was not validated, which runner would enable it (Docker daemon, `structurizr.sh` on PATH, or `STRUCTURIZR_CLI` with Java 17+), and that you will revalidate when asked. Mention the unvalidated model in CONCERNS as well.

## Offline lint and fallback exporters

`scripts/dsl.py` parses the subset of the DSL that the template uses and needs no runner:

- `workspace`, `!identifiers hierarchical`, `model`, `views`, `styles`, and skipped `configuration`, `properties`, `perspectives`, `themes`, `branding` blocks;
- `person`, `softwareSystem`, `container`, `component` with name, description, technology (containers and components) and tags, nested with braces, plus `description`, `technology`, `tags` properties inside a block;
- relationships `a -> b "description" "technology" "tags"`, with relative identifiers resolved inside the enclosing element;
- `deploymentEnvironment`, `deploymentNode`, `infrastructureNode`, `containerInstance`, `softwareSystemInstance`;
- views `systemLandscape`, `systemContext`, `container`, `component`, `deployment`, `dynamic` with `include`, `exclude`, `autoLayout`, `title`, and dynamic steps;
- `element` and `relationship` styles.

Anything else produces a warning ("not covered by the offline lint") and is skipped, so the CLI stays the authority for it.

`dsl.py lint` reports as errors: syntax shape (semicolons, single-line blocks, unbalanced braces or quotes), unknown or duplicate identifiers, unknown relationship endpoints, duplicate relationships, view scopes of the wrong kind, duplicate view keys, includes of unknown elements, dynamic steps without a matching relationship, and deployment instances of the wrong kind. It warns about missing descriptions, elements or relationships without `autoLayout`, tags without styles, the missing solid `Relationship` style, and explicit relationships that Structurizr would also draw as implied relationships (an ancestor pair with the same description as a descendant pair), which show twice in exported views. `workspace.py validate` runs the lint on `model/workspace.dsl` (`errors.dsl`) and `publish-check` on the published `workspace.dsl` (`dslLintErrors`); the publication gate fails on lint errors.

`dsl.py export --format dot|mermaid [--output DIR] [--render]` writes `structurizr-<view key>.dot` or `.mmd` per view, the same names the CLI uses, from the skill's own reading of the model: `include *` adds the scope's children and the elements directly related to them, relationships are lifted to the level of the view, boundaries wrap the scope element, `External` becomes grey (DOT) or `_Ext` (Mermaid), `Database` and `Queue` change the shape, and `Inferred` becomes dashed (DOT) or an `[inferred]` suffix (Mermaid). `--render` turns DOT into SVG with the Graphviz `dot` binary. Fidelity is below the CLI plus PlantUML: use it as the fallback renderer, and always add the Mermaid files next to the other diagram files for tools that render Mermaid.

## Export

`scripts/export-diagrams.sh` always validates before exporting. Rendered diagrams are derived artifacts; `workspace.dsl` stays authoritative, and a missing renderer never blocks discovery.

| Option | Default |
|---|---|
| `-w`, `--workspace PATH` | `docs/architecture/workspace.dsl`, relative to the current directory |
| `-f`, `--format FORMAT` | `plantuml/c4plantuml` (`mermaid` is also supported) |
| `-o`, `--output DIR` | `<DSL directory>/diagrams`, created only after validation succeeds |
| `--validate-only` | off; validate without exporting |
| `--svg` | off; after a `plantuml/*` export, render every `.puml` in the output directory to `.svg` with PlantUML |

Runner, first match wins: `STRUCTURIZR_CLI` (path to `structurizr.sh`, Java 17+ on PATH), `structurizr.sh` on PATH, then Docker running `STRUCTURIZR_IMAGE` (default `structurizr/cli:2025.11.09`).

PlantUML runner for `--svg`, first match wins: `PLANTUML_JAR` (with `java` on PATH; PlantUML runs on Java 8+), `plantuml` on PATH, then Docker running `PLANTUML_IMAGE` (default `plantuml/plantuml:1.2026.8`). Both runners are checked before validation, so a missing one fails with exit 5 before any file is written. The C4-PlantUML includes are resolved from PlantUML's bundled standard library; an export that uses URL includes needs network access on the first render. `render-report.py` turns the SVGs into a single HTML page (SKILL.md, "Diagram report").

Exit codes: `0` success; `2` invalid usage; `3` validation failed; `5` operational error or missing prerequisite (DSL file, runner, Java, Docker daemon, output directory, export failure).
