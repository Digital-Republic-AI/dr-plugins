---
description: Runs the next natural SDD step for the current feature (specify, clarify, plan, tasks, implement or verify) without the user having to pick the command
argument-hint: "[NNN-slug of the feature, or empty to use the most recent active feature] [change description, only when the next step is specify]"
allowed-tools: Read, Glob, Grep, AskUserQuestion, Bash(${CLAUDE_PLUGIN_ROOT}/scripts/resolve-next.sh:*), Bash(${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh:*), Skill(spek:start), Skill(spek:specify), Skill(spek:clarify), Skill(spek:plan), Skill(spek:tasks), Skill(spek:implement), Skill(spek:verify)
---

# Next

You advance the current feature by exactly one SDD step, running the right `/spek:*` command
yourself instead of telling the user which one to type. Arguments: `$ARGUMENTS` (optional: a
feature `NNN-slug` or slug as the first token; the remaining text is the change description, used
only when the next step is `specify`).

## Steps

1. Run `${CLAUDE_PLUGIN_ROOT}/scripts/resolve-next.sh [feature]`, passing the first token of
   `$ARGUMENTS` as `[feature]` when it looks like a `NNN-slug` or a slug (kebab-case, no spaces),
   and nothing otherwise. Parse its JSON (`feature`, `next`, `project`). The script is the single
   authority on which feature is current and what comes next -- never re-derive that from `Glob`,
   from `state.json` reads of your own, or from memory. If it exits with an error (unknown feature),
   show the error and stop.

2. No feature to advance:
   - `feature` is `null` (no `.spek/`, no features, or every feature is `verified`/`archived`):
     invoke the `Skill` tool with `skill: "spek:start"` and `args: "<remaining $ARGUMENTS>"`, follow
     it to completion, and stop.
   - `next.command` is `none` (an explicitly requested feature that is already `verified` or
     `archived`): report `next.reason` in one line and stop.

3. Restore the state file when it was inferred. If `feature.stateSource` is `inferred`,
   `state.json` is missing or invalid and the phase came from artifact presence; the conventions
   require that inference to be written back so `state.json` is the source of truth again. Run, in
   this order, using the values from the JSON:

   ```bash
   ${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh <feature.dir> init <feature.feature> <feature.slug> <feature.mode> <feature.phase>
   ${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh <feature.dir> set-context brownfield   # only if feature.artifacts.baseline is true
   ${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh <feature.dir> sync-tasks               # only if feature.artifacts.tasks is true
   ```

   If `init` refuses because a (corrupted) `state.json` already exists, tell the user the file is
   invalid and must be removed or fixed by hand before continuing, and stop. Otherwise tell the user
   in one line that the state was rebuilt from the artifacts.

4. Report one line of context before acting: `<feature.feature>` -- phase `<feature.phase>` -- next
   `/spek:<next.command>` (`<next.reason>`). When `feature.handoff` is not `null`, add its
   `status`, `tasks` and `note` to that line: it is the record of where the last implementation
   run stopped (a batch left `in-progress` by a terminated session, or the tasks that `failed`).
   `implement` handles the resumption itself; you only surface it.

5. Collect the only input a target command cannot run without. When `next.command` is `specify`
   (brownfield handoff: the baseline exists, the change has not been described yet), the change
   description is the remaining text of `$ARGUMENTS` after the feature token. If it is empty, ask the
   user in one plain-language question what change they want to make on top of the baseline, wait
   for the answer, and use it. No other target command needs input here: `clarify` asks its own
   questions, `implement` picks its own scope (the next pending phase), and `plan`, `tasks` and
   `verify` take only the feature.

6. Invoke the target command through the `Skill` tool with `skill: "spek:<next.command>"` and:
   - `args: "<description> <next.args>"` when `next.command` is `specify` (`next.args` carries
     `--slug=<slug>`, which makes `specify` write into the existing feature directory);
   - `args: "<next.args>"` for every other command (`next.args` is the `NNN-slug`).

   Follow the invoked command's steps to completion.

7. Stop after the invoked command finishes. Its own closing summary is the end of this run: do not
   run the step after it. `/spek:next` advances exactly one step per invocation; the user runs it
   again to continue.

## Rules

- Never choose the next command yourself -- only what `resolve-next.sh` returned. If you believe
  the script is wrong, say so and stop instead of overriding it.
- Never create or edit `state.json` by hand; the only writer is `update-state.sh`, and this command
  calls it only to restore an inferred state (step 3).
- Never orient the user to type another `/spek:*` command -- invoke it. The only question this
  command may ask is the change description when the next step is `specify`.
- `/spek:next` invokes `/spek:start` only when there is no active feature, and `/spek:start` invokes
  `/spek:next` only when there is one -- the two never loop.
