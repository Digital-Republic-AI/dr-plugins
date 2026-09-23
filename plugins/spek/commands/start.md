---
description: Starts or resumes the SDD flow by detecting the project state and running the right entry command (constitution, specify, extract or next)
argument-hint: "[feature description | path to existing code]"
allowed-tools: Read, Glob, AskUserQuestion, Bash(${CLAUDE_PLUGIN_ROOT}/scripts/resolve-next.sh:*), Skill(spek:constitution), Skill(spek:specify), Skill(spek:extract), Skill(spek:next)
---

# Start

You are the entry point of the SDD flow. Instead of asking the user to know which `/spek:*` command
comes first, detect what the project already has and run the right command yourself. Arguments:
`$ARGUMENTS` (optional: a feature description, or a path to existing code).

## Steps

1. Run `${CLAUDE_PLUGIN_ROOT}/scripts/resolve-next.sh` with no argument and parse its JSON
   (`project.spekDir`, `project.constitution`, `project.activeCount`, `feature`, `next`). The script
   is the single authority on what exists and what comes next -- never re-derive those facts from
   `Glob` or from memory.

2. Constitution gate. If `project.constitution` is `false`, ask via `AskUserQuestion` whether to
   create it now, with two options: "Create the constitution now" (recommended -- it is written once
   per project and every spec and plan is checked against it) and "Skip for now" (the flow works
   without it; it can be created later). If the user chooses to create it, invoke the `Skill` tool
   with `skill: "spek:constitution"` and `args: ""`, follow its steps to completion, and then
   CONTINUE with step 3 -- creating the constitution alone does not start anything.

3. Active feature gate. If `project.activeCount` is greater than 0, ask via `AskUserQuestion`
   whether to continue the current feature or start a new one, with two options: "Continue
   `<feature.feature>`" (description: current phase `<feature.phase>`, next step
   `/spek:<next.command>` -- `<next.reason>`; when `feature.handoff` is not `null`, append its
   `status`, `tasks` and `note`, so the user sees where the last implementation run stopped) and
   "Start a new feature". If the user chooses to
   continue, invoke the `Skill` tool with `skill: "spek:next"` and `args: "<feature.feature>"` and
   stop after it finishes. Otherwise continue with step 4.

4. New feature -- decide the entry point from `$ARGUMENTS`:
   - the first token is a path that exists in the project -> brownfield, entry command `extract`;
   - `$ARGUMENTS` is non-empty text and not a path -> greenfield, entry command `specify`;
   - `$ARGUMENTS` is empty -> ask via `AskUserQuestion` with two options: "New feature from a
     description" (greenfield -- `/spek:specify` writes the spec from your description) and "Change
     to existing code" (brownfield -- `/spek:extract` writes a baseline of the current behavior
     first, then the change is specified against it).

   If the chosen entry command still lacks its required input (a description for `specify`, a
   module path for `extract`), ask the user for it in one plain-language question, wait for the
   answer, and continue with step 5 using it. Never tell the user to run a command themselves.

5. Invoke the entry command through the `Skill` tool:
   - greenfield: `skill: "spek:specify"`, `args: "<description>"` (pass any `--mode=` flag the user
     included in `$ARGUMENTS` through unchanged);
   - brownfield: `skill: "spek:extract"`, `args: "<path>"`.

   Follow the invoked command's steps to completion. Its own closing summary is the end of this
   run -- do not chain into the phase after it (that is what `/spek:next` is for).

## Rules

- Never compute phases, feature numbers or "what comes next" yourself: `resolve-next.sh` decides the
  state, `new-feature.sh` (inside `specify`/`extract`) decides the numbering.
- Never orient the user to type another `/spek:*` command -- invoke it. The only things this command
  asks for are decisions (constitution, continue vs new, greenfield vs brownfield) and inputs the
  target command cannot run without (description or path).
- One entry per run: after the invoked command finishes, stop. `/spek:start` may run
  `constitution` and then `specify`/`extract` in the same run, but never more than one phase
  command of a feature.
- `/spek:start` invokes `/spek:next` only when an active feature exists, and `/spek:next` invokes
  `/spek:start` only when none does -- the two never loop.
