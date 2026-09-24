# dr-plugins

Digital Republic's marketplace of Claude Code plugins.

## Installation

```
/plugin marketplace add Digital-Republic-AI/dr-plugins
/plugin install <plugin>@dr-plugins
```

Skills distributed on their own (no plugin manifest) are namespaced by their catalog entry: `c4-codebase` is invoked as `/c4-codebase:c4-codebase`.

## Plugins

| Plugin | Version | Description |
|---|---|---|
| [spek](plugins/spek/) | 0.6.0 | Spec-driven development for the code you already have: extract, specify, clarify, plan, tasks, implement, verify |
| [c4-codebase](skills/c4-codebase/) | 1.0.0 | Evidence-based architecture discovery: C4 model in Structurizr DSL plus reviewable architecture documents. Skill only |

## Layout

- `.claude-plugin/marketplace.json` -- the catalog. Every plugin entry points at `./plugins/<name>`.
- `plugins/<name>/` -- the shipped plugin (this is what gets installed).
- `skills/<name>/` -- a skill distributed as-is, without a plugin manifest. Its catalog entry uses `"source": "./"`, `"strict": false` and `"skills": ["./skills/<name>"]`, so only that directory loads.

## Releasing a plugin

1. Bump `version` in `plugins/<name>/.claude-plugin/plugin.json` and in the catalog entry above. For a skill under `skills/<name>/`, bump `metadata.version` in its `SKILL.md` and the catalog entry instead.
2. Run `claude plugin validate plugins/<name> --strict` (or `claude plugin validate skills/` for a skill) and `claude plugin validate .`.
3. Add a CHANGELOG entry in the plugin (skills carry no CHANGELOG here; their history lives in the source repository) and commit. Users receive the update on their next marketplace refresh.

## Change History
- Created: 2026-08-30
- Updated: 2026-08-30 - Removed the spek research corpus from docs/
- Updated: 2026-08-30 - Removed docs/ (development trackers are not versioned)
- Updated: 2026-09-15 - spek updated to 0.6.0
- Updated: 2026-09-24 - Added the c4-codebase skill 1.0.0
