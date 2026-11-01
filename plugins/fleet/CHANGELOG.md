# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-01

The fleet no longer depends on the WiseWork `workforce` MCP server or on the `dr` plugin: the
work it dispatches comes from a Markdown task plan in the project, and the lead keeps the plan up
to date itself.

### Added

- Task plans: `.claude/fleet/tasks/<name>.md`, a Markdown checklist read by `/fleet plan <name>`
  and dispatched by `/fleet run <name>`. One line per item,
  `- [<mark>] <ID>: <description> [@<agent>] [needs: A, B]`, marks `[ ]` pending, `[~]` in
  progress, `[x]` completed, `[-]` cancelled; any other line is kept and ignored. An item is ready
  when it is pending and every id in `needs:` is completed or cancelled; each ready item becomes
  one worker named `task-<id>`, with the agent type of `@agent` when given. The lead writes the
  marks: `[~]` when the item is dispatched, `[x]` on the worker's `DONE`, back to `[ ]` when the
  worker is stopped (the current run does not retry it; the next `run` does). The file is read
  again at every dispatch, so an edit made between ticks is seen; the mark is the only byte the
  fleet changes. A repeated id or an unknown `needs:` is reported by `plan` and blocks `run`. A
  run whose open items all wait on items nobody is running stops with the reason. Pure helpers in
  `hooks/taskFile.ts` (`parseTaskFile`, `setMark`, `readyUnits`) and `hooks/run.ts` (the run
  reducers, moved from `dr.ts`).
- `/fleet plan` with no name lists the plan files of the project.
- Skill `task-plan` (`/fleet:task-plan <goal>`): how to split a goal into items that worker
  teammates can run in parallel, each in its own pane (disjoint files, real dependencies only,
  a done criterion per item, an optional agent type), and write them as a plan file.
- Skill `orchestrate` (`/fleet:orchestrate [plan]`): how the lead runs a plan end to end through
  the `mcp__fleet__command` tool: prerequisites, `plan` and `run`, following the pane and the
  reports, answering `BLOCKED`, stopping stale or idle workers, closing with a summary.
- Pane tab `tasks` (hotkey `t`) in place of `dr` and `ww`: the plan name, the run counters, one
  line per item with its status glyph, agent and needs, and `g:run`.
- Worker instructions: workers never edit the plan files; they keep a short task list (3 to 8
  steps); they send `BLOCKED` and wait when a decision is the lead's; they run the validations
  their change calls for and report them; they stay in the scope of their item and do not install
  dependencies or change shared configuration unless asked.

- Plain requests: words after `/fleet` that no subcommand reads (`{ kind: 'natural' }` from
  `parseCommand`) are sent to `FLEET_INTERPRETER_MODEL` (`haiku`) through `$.model.complete`, with
  the syntax (`HELP`) and the live workers (`interpreterPrompt`). The answer, `{"commands": [...]}`
  or `{"reply": "..."}` (`parseInterpretation`), runs line by line through the same `runCommand`
  as the slash command; a line that reads as a request again, an error or help is shown and not
  run, so an answer never loops. `/fleet <unknown verb>` no longer answers `unknown subcommand`.
- Lead tool `mcp__fleet__command` (`{ args }`), registered outside a worker in `session.start`
  (`armLead`), so the lead model runs fleet commands, plain requests included, when asked in the
  conversation. A worker's policy refuses it, and its handler refuses a worker too.
- `/fleet rename <name> <new-name>`: a fleet label (`Worker.label`) over the worker's name, which
  stays the engine's address and the key of run units and messages. `findWorker` matches the
  label, the pane draws it (`displayName`), `uniqueName` avoids it, and the lead publishes the
  labels under `labels:<lead session>` in the store, which each worker reads on its state timer
  to title its band `fleet worker <label> · tasks`. The iTerm2 pane title is not changed.

- Worker band frame per activity: while the worker is working the band's round frame takes a
  green border and a background that ends light, and the band's texts take an explicit text
  color from the ramp (dark on the lighter steps, since the theme text may be light on dark
  terminals); the task in progress takes the ramp's `activeText`. Idle, the frame stays the dim
  one with no background. The change fades in over `WORKER_SHADE_LAST_STEP` steps of
  `WORKER_SHADE_RAMP`, one step per `WORKER_SPINNER_MS` period, driven by the same timer as the
  spinner glyph. The ramp is raw hex, since the engine's `Color` type accepts any string and a
  theme key cannot be stepped. It fades out the same way after work ends: the timer keeps
  stepping and invalidating `ui.render` until the step is back at 0, then passes. `workerBand`
  stays pure: `WorkerBandData` carries `shadeStep` (fed from `live.shadeStep` in `register.tsx`)
  and `shadeOf(step)` picks the ramp entry, with `undefined` as the idle look.
- Worker task band visuals (#0013): the band above a worker's prompt now sits in a round, dim
  frame (`borderStyle: 'round'`, `borderDimColor`; the Box has no title prop, so the title is the
  frame's first row), its title carries the progress (`fleet worker · tasks · ⠋ working… · 2/6`
  followed by a bar of `WORKER_PROGRESS_CELLS` cells, both left out with no tasks), a completed
  task is dim and struck through, a task in progress is drawn in the `success` theme color and
  semibold, and `working…` is preceded by a glyph that cycles through `WORKER_SPINNER_FRAMES`.
  The glyph is driven from the hooks module: `armWorker` starts a `$.clock.every` timer of
  `WORKER_SPINNER_MS` (120 ms) that advances a frame counter in module state and calls
  `$.ui.invalidate('ui.render')` only while the band last drew `isWorking` true (a render hook may
  neither write state nor start a timer, so the timer lives as long as the worker and passes
  while idle); `session.end` and a reload cancel it. `workerBand` receives the frame in its data.
  `WORKER_LIST_CHROME_ROWS` is now 4 (two border rows, the title and the `n more` line) and the
  rows are fitted to `bodyColumns` minus the frame's two columns.
- No panes in a worker (#0011): a `ui.open` hook answers every pane opening inside a worker,
  from any plugin (the dr sidebar's included, the fleet's own too), with
  `{ isPlaced: false, reason }` and registers no pane, so the worker screen stays the task band.
  The verdict is the `isWorker` atom once settled, else the guard `session.start` primed; before
  that the open goes on, since the hook may run inside another plugin's draw. Verified in a real
  worker on 2026-10-23 (no dr sidebar in the worker pane, the lead's kept). The simplified worker status line (#0012) lives in the dr plugin's status
  line templates, which detect a teammate from the `--agent-name` flag of their ancestor
  processes (seen in the same worker: `worker w11 | [Fable 5.1] | 11%`); nothing changed in the
  fleet for it.
- Worker instructions in an editable file (#0008): every brief now carries the text of
  `worker/instructions.md`, or of `.claude/fleet/worker-instructions.md` when the project has one.
  The default asks workers not to commit unless told to, to leave other workers' files alone,
  never to run `git stash`, `git reset`, `git checkout -- <file>`, `git restore` or `git clean`
  on them, to keep a task list and to report only to the lead. The report rule stays in code.
- Worker guard (#0009): the lead records each worker under `workers:<sessionId>` in the store
  before spawning it, and inside a teammate the mod finds itself there from the `--agent-name` and
  `--parent-session-id` flags of its ancestor processes. A recognised worker enforces the policy
  in `worker/policy.json` (overridable by `.claude/fleet/worker-policy.json`) on every tool call:
  only the listed MCP servers (default `workforce`) and none of the denied commands (default
  `git stash`, `git reset`, `git clean`, `git checkout --`, `git restore`). A policy file that
  cannot be read falls back to no MCP server and no git command.
- Minimal worker screen (#0013): inside a worker the mod registers the `mcp__fleet__tasks` tool
  (a teammate has no TaskCreate or TodoWrite), follows its calls into `fleet.workerTasks` and
  draws the task list above the prompt, titled with the session's activity (`working…` or
  `idle`) since the spinner is hidden. The list stays within
  `maxRows`, gives way to surveys and keeps what other mods draw there. Eight render sites are
  drawn empty: assistant messages, tool uses, tool results, tool groups, user messages, the
  spinner, turn durations and tool progress. Only the drawing changes: stored messages, what the
  model receives and the report sent to the lead are left as they are.
- Output style in a worker (#0013): a `prompt.attachment` hook drops the per-turn output style
  reminder (attachment kind `output_style`, or its text as a fallback), and `session.start`
  invalidates the attachment cache once the guard is settled. The style's body itself is out of
  the mod's reach: in a real worker it is not among the `prompt.compose` sections, the named
  sections, the context blocks or the attachments the hooks see, and `outputStyle: null` on
  `prompt.compose` does not change the composition; the worker instructions tell the worker to
  ignore the inherited style. Known limit: the expanded transcript (ctrl+o) and `--verbose` are
  empty in a worker too.
- Verified in real workers on 2026-10-21 (#0008, #0009, #0013, #0014): the mod loads inside a
  split-pane teammate, the guard recognises it from its ancestor processes, denied commands and
  MCP servers are refused with the fleet's messages, the screen shows only the task band, and
  `--model haiku` starts the teammate on Haiku. Still unmeasured: the complexity classifier in a
  real worker (only an explicit `--model` and inheritance were exercised).
- Model per worker (#0014): `spawn`, `dispatch` and `run` take `--model <value>` anywhere after
  the verb; the value is an alias (`haiku`, `sonnet`, `opus`), a full model id or a complexity tier
  (`simple`, `standard`, `complex`), and `HELP` ends with a note on it. The lead picks the model
  before `$.agent.spawn`: the one asked for wins; else, when the request carries task text, the
  lead classifies it with `$.model.classify` into a tier and maps it through `modelTiers`; else the
  worker inherits. `dispatch` classifies the ticket title plus its description, read with
  `workforce_tasks_get` (a failed read is logged and the title is classified alone). `run` keeps
  `--model` for every unit; without it a unit with a DR agent keeps the agent's model and a unit
  without one has its checklist descriptions classified. An unclear label or a failed
  classification is logged and the worker inherits. Queued workers carry `model` and
  `complexityText` and are classified when they start. Pure helpers in `hooks/modelChoice.ts`.
- `modelTiers` in the worker policy (#0014): optional tier-to-model table, default
  `simple`=`haiku`, `standard`=`sonnet`, `complex`=`opus`; a partial override keeps the other
  defaults, a malformed one invalidates the policy, and the project copy overrides the plugin
  default as before.
- Test suites per module: `commands`, `workers`, `briefs`, `dr`, `tickets`, `format`, `policy`,
  `taskList`, `workerPrompt` and `modelChoice` (`hooks/*.test.ts`), next to `hooks/fleet.test.ts`.

### Changed

- Default worker policy `allowedMcpServers` is `[]` (was `["workforce"]`): a project lists the
  servers its workers may use in `.claude/fleet/worker-policy.json`.
- Worker names of plan items are `task-<id>` (were `dr-<ids>`); `WorkerTask.source` is `task`
  (was `dr`); the state keeps `fleet.taskItems` (was `fleet.drItems`) and `FleetView.taskName`
  (was `drTask`).
- The brief of a plan item names the plan file for context and tells the worker not to edit it.

- `/fleet spawn` takes several names separated by spaces (`/fleet spawn w1 w2 w3 [--type t]
  [--model m]`) and starts one worker per name, one after the other, all on the same agent type
  and model; the names past the worker limit are queued as before, and a repeated name is kept
  once. Breaking: the agent type moved from the second positional to `--type`, so
  `/fleet spawn w1 react-specialist` now starts two workers. The `spawn` command carries `names`
  in place of `name`.

- Pure logic split by subject (#0007) into `commands.ts`, `workers.ts`, `briefs.ts`, `dr.ts`,
  `tickets.ts` and `format.ts`, later joined by `policy.ts` and `taskList.ts`; `core.ts` re-exports
  them. `hooks/core.test.ts` was split into one test file per module.
- Pane tree and constants moved out of `register.tsx` (#0003) into `pane.tsx` and `constants.ts`.
  Code that uses `$` stays in `register.tsx`, because `$` may only be passed to functions declared
  in the hooks module's own file.
- Magic numbers and texts named (#0004): display limits, truncation sizes, `BLOCKED_PREFIX`,
  `TASK_TITLE_MAX`, `WORKFLOW_ERROR_MAX`, the new-worker base name and the pane sizes.
- Duplication removed (#0005): `HELP` and the usage messages come from one subcommand table, and
  `manualTask`, `taskTitle` and `openPaneQuietly` replace repeated code.

### Removed

- `/fleet ww` and `/fleet dispatch <ticket>`: the WiseWork listing and dispatch, the `workforce`
  MCP calls, `hooks/tickets.ts` and `fleet.tickets`.
- The DR plugin bridge: `workflow.py` (`list-pending`, `plan-batches`), `DR_PLUGIN_ROOT`, the
  plugin registry lookup and `hooks/dr.ts`. `/fleet plan` and `/fleet run` read the plan file
  instead.

- `/fleet close`: the pane closes with its own `x` hotkey; `/fleet close` is now read as a
  plain request.

### Fixed

- Worker band stayed idle while the worker waited on its own background subagent (a worker that
  ran `/dr:doc:project-index` ends its turn and waits for `project-doc-writer`): the band now
  counts as working while the turn runs or one of the worker's own subagents (not a teammate) is
  `pending`, `running` or `waiting`. A second worker timer reads `$.agent.list()` every
  `WORKER_BACKGROUND_POLL_MS`, since a render hook may not list agents (`hasBackgroundWork`).

- Live workers hidden by ended ones in the Fleet pane: the pane drew the first nine entries of
  the `workers` state, and ended workers (`completed`, `failed`, `killed`) were never removed, so
  after nine old ones a running worker (counted in `workers 1/4`) was not drawn at all. The pane
  now draws the live workers first, then the ended ones newest first, cut to `MAX_SELECTABLE`
  rows (`visibleWorkers`); the hotkeys `1`..`9` and the selection follow the rows drawn. Ended
  workers are pruned from the state on every reconciliation (`session.start` and each poll tick,
  with or without a roster): at most `MAX_ENDED_WORKERS` (5) are kept, newest first, and none
  older than `ENDED_WORKER_TTL_MS` (1 hour) (`pruneEnded`). The time a worker ended is kept in
  its `lastSeenAt`, stamped by `markDone` and by the roster that closes it.
- DR runs (#0001): `spawnWorker` answers `started`, `queued` or `refused`. A queued unit already
  counts as running, so it is not dispatched twice; a unit whose worker starts under another name
  follows it, and a refused one halts the run with its reason instead of being retried every
  tick. A halted run ends once its running units report.
- Hook errors are no longer swallowed (#0002): every failing hook writes its kind and message to
  the status line and the pane log, then passes the event on.
- Inconsistencies (#0006): the `n` key and `/fleet spawn` tell the worker the unique name it is
  addressed by; `markIdle` finds a worker by name or teammate id, like `reduceMessage`; the pane's
  elapsed times use the plugin clock; concurrent checks can no longer start two poll timers.
- Worker guard timing: the guard is started in `session.start` and awaited before the hook
  returns. A `ui.render` hook may not run `process.run` or write state, and a pending call dies
  with the hook that made it, so a guard first resolved from a draw was aborted and the worker ran
  unguarded with its screen visible. The render hooks now read the `isWorker` state alone, a draw
  made before the verdict is drawn again after it, and a hook failure that cannot reach the pane
  log goes to the debug log with the status line kept.
- The engine's idle notice (`idle_notification` JSON) sent by a teammate is recognised: the
  worker is marked idle in the pane and the payload is no longer logged or passed to the lead.
- The worker task tool answers text, as the engine requires of an MCP-shaped tool; an object
  result was rejected with an output-shape error on every call.

## [0.1.0] - 2026-10-20

### Added

- First release. A lead session orchestrates worker Claude Code teammates in split panes (native
  agent teams, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`), receives their results through
  `session.receive` and draws a live status pane.
- `/fleet` command: no arguments opens the status pane; subcommands `spawn <name> [type]`,
  `send <name> <text>`, `stop <name>`, `plan <task>` and `run <task>` (pending items and ready
  units of a DR task checklist), `ww` and `dispatch <ticket>` (open WiseWork tasks of the pinned
  project through the `workforce` MCP), `relay on|off` (pass worker messages on to the lead model
  or keep them in the pane), `help` and `close`.
- Roster reconciliation with a staleness heuristic: a worker with no signal for 10 minutes is
  shown as stale. Default limit of 4 workers.
- Typed state contract in `types/index.d.ts` (`fleet.workers`, `fleet.queue`, `fleet.log`,
  `fleet.view`, `fleet.relay`, `fleet.run`, `fleet.drItems`, `fleet.tickets`).
- Test suites: `hooks/core.test.ts` (pure reducers and helpers) and `hooks/fleet.test.ts`
  (engine).
