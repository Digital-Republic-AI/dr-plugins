# Contributing to dr-plugins

> Created: 2026-11-08 | Last updated: 2026-11-08

## Layout

- `.claude-plugin/marketplace.json` -- the catalog. Every plugin entry points at `./plugins/<name>`.
- `plugins/<name>/` -- the shipped plugin (this is what gets installed).
- `skills/<name>/` -- a skill distributed as-is, without a plugin manifest. Its catalog entry uses `"source": "./"`, `"strict": false` and `"skills": ["./skills/<name>"]`, so only that directory loads.

## Releasing a plugin

1. Bump `version` in `plugins/<name>/.claude-plugin/plugin.json` and in the catalog entry above. For a skill under `skills/<name>/`, bump `metadata.version` in its `SKILL.md` and the catalog entry instead.
2. Run `claude plugin validate plugins/<name> --strict` (or `claude plugin validate skills/` for a skill) and `claude plugin validate .`.
3. Add a CHANGELOG entry in the plugin (skills carry no CHANGELOG here; their history lives in the source repository) and commit. Users receive the update on their next marketplace refresh.

When a plugin or skill is added, renamed or bumped, also update its row in the catalog table and its section in [README.md](README.md) and [README.pt-BR.md](README.pt-BR.md).

## Change History

- Created: 2026-11-08 - Layout and release steps moved from README.md
