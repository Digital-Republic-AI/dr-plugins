# dr-plugins

Digital Republic's marketplace of Claude Code plugins.

## Installation

```
/plugin marketplace add Digital-Republic-AI/dr-plugins
/plugin install <plugin>@dr-plugins
```

## Plugins

| Plugin | Version | Description |
|---|---|---|
| [spek](plugins/spek/) | 0.6.0 | Spec-driven development for the code you already have: extract, specify, clarify, plan, tasks, implement, verify |

## Layout

- `.claude-plugin/marketplace.json` -- the catalog. Every plugin entry points at `./plugins/<name>`.
- `plugins/<name>/` -- the shipped plugin (this is what gets installed).

## Releasing a plugin

1. Bump `version` in `plugins/<name>/.claude-plugin/plugin.json` and in the catalog entry above.
2. Run `claude plugin validate plugins/<name> --strict` and `claude plugin validate .`.
3. Add a CHANGELOG entry in the plugin and commit. Users receive the update on their next marketplace refresh.

## Change History
- Created: 2026-08-30
- Updated: 2026-08-30 - Removed the spek research corpus from docs/
- Updated: 2026-08-30 - Removed docs/ (development trackers are not versioned)
- Updated: 2026-09-15 - spek updated to 0.6.0
