# Fleet

Last updated: 2026-11-01

Fleet turns a Claude Code session into a lead that orchestrates worker Claude Code teammates, each in its own split pane. The lead spawns workers, dispatches work to them, collects their reports and shows a live status pane. The work comes from a task plan: a Markdown checklist in the project, with dependencies and optional agent types, that the lead keeps up to date as workers report.

Version: 0.2.0 (see [CHANGELOG.md](CHANGELOG.md), which also lists unreleased changes). License: MIT.

## Features

- Spawn, message, rename and stop worker teammates from the `/fleet` command, from the status pane or by asking in the conversation.
- Task plans: `.claude/fleet/tasks/<name>.md` lists the items; `/fleet run <name>` dispatches the ready ones to workers, marks them in the file as they start and finish, and dispatches the items that waited on them.
- Live status pane with the roster, a log and the plan items.
- Per-worker model choice: an explicit `--model`, or an automatic pick from the item's complexity.
- Worker guard: a worker enforces a policy on every tool call (allowed MCP servers, denied git commands).
- Minimal worker screen: inside a worker, the screen shows a task band with progress instead of the full transcript.
- Two skills for the lead model: `task-plan` splits a goal into parallel items and writes the plan file; `orchestrate` runs and supervises a plan.

## Prerequisites

- Claude Code with agent teams enabled: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, set in the shell or in the `env` block of `settings.json`. Without it the plugin answers "Agent teams are off"; restart Claude Code after setting it.
- A team mode with panes (`tmux`, `iterm2` or `auto`), so each worker gets its own split pane.

No MCP server and no other plugin are required.

## Installation

```
/plugin marketplace add Digital-Republic-AI/dr-plugins
/plugin install fleet@dr-plugins
```

Restart Claude Code after installing.

## Usage

Run `/fleet` with no arguments to open the status pane.

| Command | Description |
|---|---|
| `/fleet` | Open the status pane |
| `/fleet spawn <name> [name...] [--type t] [--model m]` | Start one worker teammate per name, each in its own pane; every name gets the same agent type and model, and the names past the worker limit are queued |
| `/fleet send <name> <text>` | Message a worker |
| `/fleet stop <name>` | Stop a worker. A worker holding a plan item gives it back (`[ ]`); the current run does not retry it, the next `run` does |
| `/fleet rename <name> <new-name>` | Give a worker a new name in the fleet: the pane, the worker's own screen, `send` and `stop` use it. The engine still addresses the teammate by its original name, and the iTerm2 pane title is left as Claude Code sets it |
| `/fleet plan [task]` | List the task plans in `.claude/fleet/tasks/`, or load one and show its items in the pane |
| `/fleet run <task> [--model m]` | Dispatch the ready items of a task plan to workers, one worker per item |
| `/fleet relay on\|off` | Pass worker messages on to the lead model, or keep them in the pane |
| `/fleet help` | Show the subcommands |
| `/fleet <anything else>` | A plain request, e.g. `/fleet abre dois workers opus chamados a e b`: a small model (`haiku`) reads it into the commands above, which then run in order; each command run is shown before its result. A request no command can do gets a short reply and runs nothing |

Pane hotkeys seen in `hooks/pane.tsx`: `x` close, `w`/`t` switch tab, `1`..`9` select a worker, `n` new worker, `m` message the selected worker, `k` stop it, `r` toggle relay, `g` run the loaded plan.

### Asking in the conversation

Outside a worker, the fleet gives the lead model a tool, `mcp__fleet__command`, that takes what would follow `/fleet` (a command line or a plain request). Asking Claude in the conversation ("abre 3 workers opus para documentar X", "renomeia o w1 para docs", "roda o plano csv-export") is enough: it calls the tool, with no `/fleet` typed. Workers do not get the tool.

At most 4 workers run at once by default; further requests are queued and start as workers finish. A worker with no signal for 10 minutes is shown as stale. Ended workers are pruned from the pane: at most 5 are kept, none older than 1 hour.

### Task plans

A plan is a Markdown file at `.claude/fleet/tasks/<name>.md`:

```markdown
# CSV export on the reports page

Export the current report filters as CSV. Keep the JSON endpoint untouched.

- [ ] T1: Add GET /api/reports/export.csv in api/reports/export.ts, with a unit test @nodejs-specialist
- [ ] T2: Add the Download button in web/src/pages/reports/Toolbar.tsx, with a component test @react-specialist
- [ ] T3: Document the endpoint in docs/api/reports.md
- [ ] T4: End-to-end test: apply a filter, download, assert the header row needs: T1, T2
```

- One line per item: `- [<mark>] <ID>: <description> [@<agent>] [needs: A, B]`. Any other line is kept and ignored.
- Marks: `[ ]` pending, `[~]` in progress, `[x]` completed, `[-]` cancelled.
- An item is ready when it is pending and every id in `needs:` is completed or cancelled. `run` dispatches the ready items up to the worker limit, one worker per item named `task-<id>`, then the items that waited on them as their workers report `DONE`.
- The lead writes the marks: `[~]` when an item is dispatched, `[x]` on `DONE`, back to `[ ]` when the worker is stopped. Only the mark changes; the rest of the file is left byte for byte. The file is read again at every dispatch, so an edit made between ticks is seen. Workers are told not to edit it.
- `@agent` names the agent type the worker starts as; it keeps the agent's model. An item without one has its description classified by complexity.
- A repeated id or a `needs:` naming an unknown id is reported by `plan` and blocks `run`. A run whose open items all wait on items nobody is running stops and says which.

The `task-plan` skill (`/fleet:task-plan <goal>`) writes such a file from a goal, cutting the work into items that can run in parallel; the `orchestrate` skill (`/fleet:orchestrate [name]`) walks the lead through running one.

### Model per worker

`--model` takes an alias (`haiku`, `sonnet`, `opus`), a full model id or a complexity tier (`simple`, `standard`, `complex`). Without it, the lead classifies the item text by complexity and maps the tier to a model through `modelTiers`; if that fails, the worker inherits the lead's model. A plan item with an `@agent` keeps the agent's model.

## Configuration

| File | Purpose |
|---|---|
| `worker/policy.json` | Default worker policy: `allowedMcpServers` (none), `deniedCommands` (`git stash`, `git reset`, `git clean`, `git checkout --`, `git restore`) and `modelTiers` (`simple`=`haiku`, `standard`=`sonnet`, `complex`=`opus`) |
| `.claude/fleet/worker-policy.json` | Project override of the policy above; list here the MCP servers the workers may use |
| `worker/instructions.md` | Default rules appended to every worker brief |
| `.claude/fleet/worker-instructions.md` | Project override of the worker instructions |
| `.claude/fleet/tasks/<name>.md` | The task plans of the project |

A policy file that cannot be read falls back to no MCP server and no git command. A partial `modelTiers` override keeps the other defaults; a malformed one invalidates the policy.

## Project structure

```
plugins/fleet/
  .claude-plugin/plugin.json   plugin manifest (types: ./types/index.d.ts)
  hooks/hooks.json             loads ./register.tsx
  hooks/register.tsx           engine side: commands, polling, spawning, plan runs, worker guard
  hooks/pane.tsx               status pane tree
  hooks/workerView.tsx         task band shown inside a worker
  hooks/*.ts                   pure logic: commands, workers, briefs, taskFile, run,
                               format, policy, taskList, modelChoice, interpreter, constants
  hooks/*.test.ts              test suites, one per module plus fleet.test.ts
  skills/task-plan/            skill: split a goal into a plan file
  skills/orchestrate/          skill: run and supervise a plan
  worker/                      default policy and worker instructions
  types/index.d.ts             typed state contract (fleet.workers, fleet.queue, fleet.taskItems, ...)
```

## Testing

Tests live in `hooks/*.test.ts` and import from `claude-code/testing`. The engine's own runner executes them; there is no `package.json` to go through. From the repository root:

```bash
claude plugin test plugins/fleet
npx tsc --noEmit -p plugins/fleet/tsconfig.json
claude plugin validate plugins/fleet
```

`tsconfig.json` extends `.claude-plugin/types/tsconfig.json`, which carries the engine's type declarations.

## Known limits

- The expanded transcript (ctrl+o) and `--verbose` are empty inside a worker.
- The complexity classifier was not measured in a real worker; only an explicit `--model` and inheritance were exercised (see the changelog).
- A plan item is one worker; items cannot be grouped under one worker. Group the work in the item's description instead.

## License

MIT, see [LICENSE](LICENSE).

## Change History

- Created: 2026-10-23
- Updated: 2026-10-23 - Testing section: the engine runner command, the type check and the validation
- Updated: 2026-10-26 - `/fleet spawn` takes several names and the agent type through `--type`
- Updated: 2026-10-26 - `/fleet close` removed; the pane closes with its `x` hotkey
- Updated: 2026-10-26 - Plain requests after `/fleet`, the lead tool `mcp__fleet__command` and `/fleet rename`
- Updated: 2026-11-01 - 0.2.0: task plans in Markdown, skills `task-plan` and `orchestrate`, WiseWork and DR dependencies removed
