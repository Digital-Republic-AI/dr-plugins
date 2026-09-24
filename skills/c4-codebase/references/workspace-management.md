# Workspace Management

The workspace is the durable working memory of one discovery. `workspace.py` owns its structure; the agent owns its semantic content.

## Contents

- Location
- Structure and responsibilities
- Versioning policy
- Paths and scope
- Freshness
- Repair, backup, and cleanup

## Location

Scripts resolve the workspace in this order:

1. `--workspace <dir>`;
2. `<repository root>/.c4-codebase/` when it exists;
3. `$C4_CODEBASE_HOME/<repository name>-<root commit prefix>/` (home defaults to `~/.c4-codebase`) when it exists;
4. otherwise `<repository root>/.c4-codebase/`, or the external path when `init --external` is used.

Use the external location when the repository is read-only or the user does not want files in it. `status` and `scan.py --save` find an existing external workspace automatically.

## Structure and responsibilities

```text
.c4-codebase/
├── .gitignore            versioning policy written by init
├── state.json            identity, baseline, scope, output directory, phases, units, invalidations
├── evidence.jsonl        immutable observations
├── hypotheses.jsonl      claims with confidence; revisions are appended
├── questions.jsonl       question ledger; revisions are appended
├── questions.md          rendered from questions.jsonl; never edit by hand
├── inventory.md          reconnaissance summary and scope hypothesis
├── scan.json, scan.md    deterministic scan; regenerable
├── checkpoints/          cp-NNN.json bounded-work checkpoints
├── perspectives/         seven working documents
├── model/workspace.dsl   working copy of the Structurizr model
└── backups/              created by backup and migrate
```

Write ledgers through `workspace.py` (`evidence add`, `hypothesis add|revise`, `question add|answer|dismiss`). The only allowed manual ledger edit is redacting a leaked secret, followed by `validate`.

## Versioning policy

Ask once, on the first run, and pass the answer to `init --versioning`:

- `shared` (recommended): commit state, ledgers, questions, inventory, checkpoints, perspectives, and model so teammates, CI, other machines, and worktrees can resume. `scan.json`, `scan.md`, and `backups/` stay ignored because they are regenerable or local.
- `local`: the workspace ignores itself (`.gitignore` with `*`) and nothing is committed. Published documents then cannot reference ledger ids (references/publication.md).

The choice is stored as `versioning` in `state.json`. Rerunning `init` does not change it; if the user changes their mind, back up, then edit `.gitignore` and `state.json` together and run `validate`.

The workspace stores no absolute paths: identity is the root commit and remote, remotes are stored without credentials, and every path is repository-relative.

## Paths and scope

- `--repo` may point anywhere inside the repository; scripts resolve the git top-level, and a subdirectory becomes the scope recorded at `init`. `status` warns when a later request uses a different scope.
- Evidence `path`, unit `paths`, and changed paths are POSIX paths relative to the repository root, never to the scope or the current directory.
- Without git, the given directory is the root.

## Freshness

Modification times in `status` are operational hints only. Semantic freshness comes from:

- `baselineRevision` and `currentRevision` (`revisionChanged`, true only when paths outside the workspace and the skill's published documents changed);
- `dirty` and `dirtyPaths`, uncommitted changes outside the workspace and the skill's published documents; evidence captured while dirty carries `dirty: true` and describes content that is in no commit;
- each unit's `analyzedRevision`;
- evidence `fingerprint`, the SHA-256 prefix of the file at capture time;
- `invalidations`, written by `invalidate`.

## Repair, backup, and cleanup

- Missing skeleton files: `init` recreates them without touching existing files.
- Malformed state: preserved and reported; follow references/state-machine.md.
- Backups: run `workspace.py backup` before manual edits; `migrate` backs up automatically.
- Cleanup, only when the user asks: delete the workspace directory (in the repository or the external location). Published documents are independent and stay.
