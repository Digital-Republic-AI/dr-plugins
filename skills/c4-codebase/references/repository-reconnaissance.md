# Repository Reconnaissance

Reconnaissance answers what exists before semantic architecture inference begins.

## Required sequence

1. Run `${CLAUDE_SKILL_DIR}/scripts/scan.py --repo . --save`, then read `scan.md` in the workspace; use `scan.json` for exact lists.
2. Check the blind spots before trusting any absence: `truncated`, `walkErrors`, `excludedDirectories`, `limits`, and `warnings`.
3. Read intent documents and API specifications; record each relevant one with `workspace.py evidence add --kind documentation --intent`.
4. Summarize stated intent separately in `inventory.md`.
5. Inspect manifests, workspace definitions, and build files.
6. Inspect deployment and infrastructure descriptors and CI/CD.
7. Inspect entrypoint candidates, high confidence first.
8. Identify monorepo and project boundaries.
9. Record the initial inventory and register investigation units.

## Reading scan.json

| Key | Use |
|---|---|
| `repository` | name, scope, revision, branch, remote without credentials, root commit, dirty flag |
| `fileSource` | `git` (tracked and untracked files, honoring .gitignore) or `filesystem` |
| `counts`, `languagesByFileCount` | size and language mix; `sourceFiles: 0` triggers the empty-repository edge case in SKILL.md |
| `manifests`, `workspaceDefinitions`, `monorepoSignals` | build topology and workspace members |
| `intentDocuments` | `{path, matchedBy}` candidates to read before source code |
| `apiSpecifications` | OpenAPI, Swagger, AsyncAPI, protobuf, and GraphQL files |
| `generatedArtifacts` | files carrying a skill marker (published output, templates); never treat them as intent |
| `entrypointCandidates` | `{path, rule, confidence}`; `low` marks generic names such as `index.ts` that may belong to a library |
| `deploymentAndInfrastructure`, `ciCd`, `environmentTemplates` | runtime and delivery signals; never copy values from environment files |
| `submodules` | external repositories, see the edge cases in SKILL.md |
| `directoryTree`, `topLevelDensity` | where the files are, aggregated by directory |
| `excludedDirectories`, `walkErrors`, `truncated`, `limits`, `warnings` | what the scan could not see |
| `recentCommits`, `highChurnPaths` | prioritization and CONCERNS input, not architecture truth |

## Intent documents

The scanner matches names and folders such as:

- README;
- PRD and TRD;
- ROADMAP;
- SPEC and specification;
- DESIGN;
- ARCHITECTURE;
- ADR and RFC material;
- any document under `docs/`, `doc/`, `documentation/`, or `adr/`;
- API specifications (OpenAPI, AsyncAPI, protobuf, GraphQL);
- runbooks and deployment documentation.

Treat all of them as stated or historical intent and cross-check them with the current implementation. A document whose name merely contains one of these words, such as a reference guide, is still only a candidate: read it and decide.

## High-value repository signals

### Build and dependency manifests
Examples include `package.json`, `pyproject.toml`, `go.mod`, `pom.xml`, Gradle files, Cargo files, .NET projects and solutions, Composer, Gemfile, Flutter pubspec, CMake, and Bazel files.

### Runtime and deployment signals
Dockerfiles, Compose, Kubernetes, Helm, Terraform, Pulumi, CloudFormation, Serverless, CDK, platform descriptors (Procfile, fly.toml, vercel.json, netlify.toml, app.yaml, skaffold.yaml), deployment scripts, process managers, and CI/CD workflows.

### Entrypoint signals
Server bootstrap files, CLI entrypoints, framework application startup, worker consumers, queue handlers, scheduled jobs, serverless handlers, and frontend application roots.

### Configuration signals
Environment templates, configuration modules, feature flags, service URLs, queue and topic names, database configuration, and authentication providers. Record key names only.

### Integration signals
HTTP, gRPC, and GraphQL clients, SDK initialization, database drivers and ORMs, queue and event clients, storage clients, and mail, payment, authentication, and observability providers.

## Monorepo rules

Do not assume root manifests represent the production runtime. Use `workspaceDefinitions` to map each independently deployable application or service. Distinguish shared libraries from deployable units.

## Generated output rules

Exclude generated and build output from source conventions and implementation evidence unless the generated artifacts are deployed runtime units. In git repositories the scanner follows `.gitignore`. Without git it always skips dependency and tooling folders, and skips build output folders (`dist`, `build`, `out`, `target`, `bin`, `obj`, `vendor`, `coverage`, and similar) only when the root `.gitignore` lists them. Inspect any excluded directory that might hold deployable code, such as a committed `bin/` or `vendor/`.

## Git history signals

Recent churn can identify fragile or evolving areas. Churn is not architecture truth, but it can prioritize investigation and populate CONCERNS.

## Reconnaissance completion

Reconnaissance is complete when the agent can state, with evidence ids:

- the likely repository type and scope;
- the technology and build topology;
- candidate deployables and runnables;
- candidate data, integration, and infrastructure surfaces;
- the investigation unit plan;
- major unknowns that block partitioning.
