---
description: Decomposes the plan into a list of executable tasks, grouped by user story and with explicit dependencies
argument-hint: "[NNN-slug of the feature, or empty to use the most recent feature]"
allowed-tools: Read, Glob, Grep, Bash(${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh:*)
---

# Tasks

## Steps

1. Resolve the target feature (same `$ARGUMENTS` resolution logic as the `/spek:clarify` command).
   Verify that `.spek/specs/NNN-slug/plan.md` exists -- if it does not, stop and recommend `/spek:plan`
   first.

2. Delegate the writing of `.spek/specs/NNN-slug/tasks.md` to the `spek:task-breaker` subagent,
   invoking it ONCE. The subagent scaffolds the file through its preloaded `sdd-templates` skill,
   fills it in place, and returns only a short completion notice -- the path written and any
   problem it hit. It must NEVER return the
   task list to you, and you must NEVER write or rewrite task content yourself. Pass it:
   - the paths of `.spek/specs/NNN-slug/spec.md` (to map tasks to user stories) and
     `.spek/specs/NNN-slug/plan.md` (the subagent reads them itself; never paste artifact content
     into the prompt)
   - the feature directory `.spek/specs/NNN-slug/` -- the subagent scaffolds `tasks.md` in it; never
     paste template content into the prompt
   - the format and phase requirements of steps 3 and 4 below, which the subagent applies

   The scaffold script and the `PreToolUse` hook enforce the same rule: `tasks.md` can only be
   created once `plan.md` exists, which step 1 already guarantees.

3. Every generated task must follow the format `[ID] [P?] [Story] Description with exact file path`,
   where `[P]` marks parallelizable tasks (different files, no dependency) and `[Story]` links the
   task to a user story of the spec (US1, US2, ...).

4. Organize the tasks into phases: Setup -> Foundational -> per User Story (in priority order, each
   one independently testable) -> Polish. Within each user story, mark which tasks are blocking and
   which are parallel.

5. After the subagent reports completion, confirm that `.spek/specs/NNN-slug/tasks.md` exists
   (`Glob` on the path, or `Read` of its first lines). If the file is missing, stop and report the
   failure -- never fill the gap by writing the tasks yourself.

6. Advance the state with two script calls, both AFTER `tasks.md` has been written to disk -- never
   hand-edit `state.json`:
   - `${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh .spek/specs/NNN-slug set-phase tasks`
   - `${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh .spek/specs/NNN-slug sync-tasks`
   The first sets `phase` and appends to `history`; the second derives `totalTasks` and
   `completedTasks` by counting the checkboxes in the `tasks.md` file that was just written, so the
   counters always match the real artifact instead of a number reported by the model.

7. Suggest `/spek:implement` as the next step, reporting how many tasks were generated and how many
   can run in parallel in the first phase. Take the total from the `sync-tasks` output
   (`totalTasks`) and the parallel count from a `Grep` over the written `tasks.md` -- never from the
   subagent's notice or from memory.

## Rules

- Tasks are the only phase where order/dependency is rigidly enforced (unlike the plan, which is
  informational) -- every blocking task must explicitly list which IDs it depends on.
- Tests are OPTIONAL: only include test tasks if the spec or the user explicitly asked for them.
- Every user story must be deliverable and testable independently of the others (never create a task
  that requires two complete user stories to be verifiable).
- Responsibilities are split and never swapped: the prerequisite check (step 1) and the state
  update (step 6) are yours; the task list (step 2) is the `spek:task-breaker` subagent's, which
  writes `tasks.md` directly and reports only completion -- the content never travels back through
  you.
