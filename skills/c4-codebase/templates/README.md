<!-- c4-codebase:template -->
# Architecture Documentation

<!-- Publication template. Replace the first line with the markdown header from `workspace.py publish-check --json`. Follow references/publication.md. -->

| Field | Value |
|---|---|
| Repository | [TODO] repository name |
| Scope | [TODO] whole repository or repository-relative subpath |
| Analyzed revision | [TODO] commit SHA; state whether uncommitted changes were present |
| Generated at | [TODO] ISO-8601 timestamp |
| Discovery workspace | [TODO] `.c4-codebase/` committed (shared) or not versioned (local) |

## How to read these documents

Claims carry labels. `observed` claims are backed by repository evidence, `inferred` claims are conclusions with a confidence level, and `confirmed` claims were confirmed by a person or an authoritative source. `Unknown` marks facts that could not be established from the repository.

## Documents

| Document | Answers |
|---|---|
| [STACK.md](STACK.md) | Languages, runtimes, frameworks, and build tooling per unit |
| [STRUCTURE.md](STRUCTURE.md) | Repository shape, deployables, shared libraries, entrypoints |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Scope, runtime building blocks, interactions, patterns, topology |
| [CONVENTIONS.md](CONVENTIONS.md) | Module, dependency, error, and configuration conventions |
| [INTEGRATIONS.md](INTEGRATIONS.md) | Inbound interfaces, external systems, data stores, messaging |
| [TESTING.md](TESTING.md) | Test levels and the runtime contracts they evidence |
| [CONCERNS.md](CONCERNS.md) | Divergences, suspected dead code, risks, low-confidence claims |
| [workspace.dsl](workspace.dsl) | Canonical C4 model in Structurizr DSL |

## Views

[TODO] One line per view in workspace.dsl: key, type, and the question it answers.

## Rendering diagrams

[TODO] Command used to validate and export the model, or the reason it was not run. When `diagrams/index.html` was generated, say so and link it.

## Intent vs reality

[TODO] The most important divergences; details in CONCERNS.md.

## Open questions

[TODO] Unresolved architecture-changing questions with their ids, or "None".
