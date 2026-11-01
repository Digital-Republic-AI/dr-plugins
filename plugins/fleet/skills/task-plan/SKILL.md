---
name: task-plan
description: Splits a goal into a fleet task plan - small, independent items that worker teammates can run in parallel, each in its own pane - and writes it as a Markdown checklist in .claude/fleet/tasks/<slug>.md. Use when the person wants work divided among fleet workers, asks to plan a task for the fleet, to parallelize a job, or mentions a task plan, panes or workers before running /fleet run.
argument-hint: <goal or feature to split into parallel items>
---

# Fleet task plan

You are the lead of a fleet of Claude Code worker teammates. Each item of the plan you write
becomes one worker in one split pane, started by `/fleet run <slug>`. The value of the plan is in
how the work is cut: the more items that can run at the same time without stepping on each
other, the more the fleet pays off. Dependencies serialize the work; declare only the real ones.

## Procedure

1. **Understand the goal.** Restate it in one sentence. If the goal is ambiguous enough that two
   readings would give different plans, ask once, every question together, then continue.
2. **Explore enough to know what each item touches.** Read the files the goal involves, find
   the entry points, the tests and the shared modules. You need to know which files each item
   will edit, because two items editing the same file cannot run in parallel.
3. **Cut the work into items.** Each item is one worker's job for one session:
   - Small enough to finish in one sitting; large enough to be worth a pane (not a one-line fix).
   - Self-contained: it names the files it touches and what "done" means (tests pass, a command
     runs, a page renders).
   - Disjoint from the other parallel items: no two parallel items edit the same file. When two
     items need the same file, merge them into one item, or make one wait on the other with
     `needs:`.
   - Verifiable by the worker itself: it can run the tests or the command that proves the item.
4. **Order with dependencies only where they are real.** An item waits on another only when it
   needs the other's output (a type, a module, a migration). "It would be nice to do first" is
   not a dependency. Aim for a plan whose first wave has several items.
5. **Pick an agent type where one helps.** `@<agent>` names an agent type available in this
   session (list them with the Agent tool's agent types). Leave it out when the default agent
   does; a worker with an agent keeps the agent's model, one without is classified by complexity.
6. **Write the file** at `.claude/fleet/tasks/<slug>.md` (create the directory if needed), in the
   format below, with every item `[ ]`. The slug is lowercase, digits and hyphens.
7. **Hand over.** Show the plan, then tell the person the two commands: `/fleet plan <slug>` to
   review it in the Fleet pane and `/fleet run <slug>` to dispatch it. Do not run them yourself
   unless asked; the orchestrate skill covers the run.

## File format

```markdown
# <Title of the plan>

<Optional context: one or two lines on the goal and the constraints every worker must respect.>

- [ ] T1: <what to do, which files, how to verify> @python-specialist
- [ ] T2: <what to do> needs: T1
- [ ] T3: <what to do> @react-specialist needs: T1, T2
```

- One line per item: `- [<mark>] <ID>: <description> [@<agent>] [needs: A, B]`.
- Marks: `[ ]` pending, `[~]` in progress, `[x]` completed, `[-]` cancelled. Write every new item
  as `[ ]`; the fleet lead changes the marks as workers start and report.
- IDs: a letter followed by letters, digits, `_` or `-` (`T1`, `api-2`). Unique within the file.
- `@agent` and `needs:` may come in any order at the end of the line. `needs:` takes a
  comma-separated list of IDs from the same file.
- Any other line (title, prose, blank) is kept and ignored by the fleet.
- An item's description is the worker's whole brief for that item, together with the file's
  context lines: write it so a worker who has never seen the conversation can do the job.

## Anti-patterns

- Items too large: "implement the feature" as one item wastes the fleet. Split by layer, module
  or screen.
- Items too small: ten one-line items cost ten panes of overhead. Group small related changes
  to the same files into one item.
- False dependencies: a chain `T1 -> T2 -> T3 -> T4` runs one worker at a time. Challenge each
  `needs:`.
- Parallel items that share a file: both workers edit it, one clobbers the other. Merge or
  serialize.
- An item without a done criterion: the worker cannot know when to report. Add the test, the
  command or the visible result that proves it.
- Items that commit, install dependencies or change shared configuration without saying so:
  workers do not do these unless the item asks for them.

## Example

Goal: add CSV export to the reports page.

```markdown
# CSV export on the reports page

Export the current report filters as CSV. Backend in `api/reports/`, frontend in
`web/src/pages/reports/`. Keep the existing JSON endpoint untouched.

- [ ] T1: Add `GET /api/reports/export.csv` in `api/reports/export.ts` taking the same query params as the JSON endpoint, streaming CSV; unit test in `api/reports/export.test.ts` @nodejs-specialist
- [ ] T2: Add `exportCsv(filters)` to `web/src/api/reports.ts` and a Download button in `web/src/pages/reports/Toolbar.tsx` calling it; component test for the button @react-specialist
- [ ] T3: Document the endpoint in `docs/api/reports.md` (params, response headers, example curl)
- [ ] T4: End-to-end test in `e2e/reports-export.spec.ts`: apply a filter, download, assert the header row needs: T1, T2
```

T1, T2 and T3 run in parallel; T4 waits for the two it exercises.
