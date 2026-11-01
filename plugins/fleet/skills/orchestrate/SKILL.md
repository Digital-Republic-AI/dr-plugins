---
name: orchestrate
description: Runs a fleet task plan end to end as the lead - checks the prerequisites, loads and dispatches the plan with /fleet run, follows the workers in the Fleet pane and through their DONE and BLOCKED reports, answers blocked workers, restarts failed items, stops idle workers and closes the run with a summary. Use when the person asks to run, execute, orchestrate, delegate or supervise a task plan or the fleet workers, or after a plan was written with the task-plan skill.
argument-hint: [plan name] [--model m]
---

# Fleet orchestration

You are the lead. The fleet does the mechanics (spawning panes, reading and writing the plan
file, collecting reports); you make the decisions: what to run, what to answer a blocked
worker, when to stop a worker, when the job is done. Every fleet action goes through the
`mcp__fleet__command` tool, whose `args` is what the person would type after `/fleet`.

## Prerequisites

Before the first run of a session, check once:

- Agent teams are on (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) and `teammateMode` is a pane
  mode (`tmux`, `iterm2`, `auto`). `/fleet spawn probe` answers with the exact setting to fix if
  not; stop that probe afterwards (`stop probe`).
- The plan exists: `plan` lists the plans in `.claude/fleet/tasks/`. No plan yet: use the
  task-plan skill first.
- The worker policy fits the project: `.claude/fleet/worker-policy.json` lists the MCP servers
  workers may use (none by default) and the git commands they may not run.

## Run

1. `plan <name>`: the items are shown in the Fleet pane (tab `t`). Read them back: an error
   (unknown `needs:`, a repeated id) must be fixed in the file before running; an item already
   `[~]` from an earlier session is someone else's or a leftover, ask before resetting it to
   `[ ]`.
2. `run <name> [--model m]`: the fleet dispatches every ready item (pending, needs settled) up
   to the worker limit (4 by default), marks them `[~]` in the file and queues the rest. Each
   worker is named `task-<id>`. `--model` puts every item on one model; without it an item with
   `@agent` keeps the agent's model and the others are classified by complexity.
3. Do not edit the plan file while a run is going: the fleet writes the marks. To add items, let
   the run end or stop it, edit, run again.

## Follow

- The Fleet pane (tab `w`) shows every worker, its status, its elapsed time and its item; the log
  below shows what happened. Open it with `/fleet` or by asking.
- Worker messages stay in the pane unless `relay on` is set. Turn relay on when you need to read
  the reports in the conversation (to review what was done, to decide a BLOCKED), and off again
  when the noise is not worth it. A `BLOCKED` message always reaches you.
- A `DONE <ids>` report marks the items `[x]` in the file, closes the worker and dispatches the
  items that were waiting on them. The run ends with "run <name> complete" when nothing is
  pending or in progress.
- A worker shown `idle` without a report is waiting for you or finished without reporting:
  `send <name> <text>` to ask for its report, or `stop <name>` once you have what you need.
- A worker `stale` (no sign of life for 10 minutes) or `failed`: `stop <name>`. Its items go
  back to `[ ]` and the current run does not retry them; `run <name>` again once the run ended
  picks them up.

## Unblock

A `BLOCKED <reason>` report is a question for you. Decide, then `send <worker> <answer>` with
what the worker needs: the decision, the file to use, the credential's location, the scope
cut. Do not do the worker's item yourself in the lead session while the worker holds it; if you
must take it over, `stop` the worker first. Never answer with "use your judgement": the worker
asked because the judgement is yours.

## Close

When the run reports complete, or when every open item is settled:

1. Confirm the file: every item `[x]` or `[-]`; a `[~]` left over means a worker ended without a
   report, find out from the pane log.
2. `stop` any worker still live that has nothing left (manual workers you spawned, a worker
   idle after its report).
3. Summarize for the person: the items done with their files, the validations the workers
   reported, what was left open or cancelled and why, and the next step (review, commit, a new
   plan). Commits are the person's call unless they asked for them.

## Limits

- At most the configured number of workers run at once; the rest queue. Do not try to work
  around it by spawning manual workers for plan items.
- Workers share the working tree: two items that edit the same file must not run together. If
  the plan has such a pair, stop the run and fix the plan (merge or `needs:`).
- A worker does not run `/fleet` commands or spawn its own teammates.
