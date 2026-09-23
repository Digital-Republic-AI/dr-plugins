---
description: Creates or updates the project constitution (the engineering principles every spec and plan must respect)
argument-hint: "[free text describing principles, or empty to review the existing constitution]"
allowed-tools: Read, Edit, MultiEdit, Glob, Grep, AskUserQuestion, Skill(spek:sdd-templates), Bash(${CLAUDE_PLUGIN_ROOT}/skills/sdd-templates/scripts/scaffold.sh:*)
---

# Constitution

You are creating or updating the `.spek/constitution.md` file of the current project. The constitution
is the set of non-negotiable principles that every spec, plan and task in this project must respect
(analogous to a living architecture guide).

## Steps

1. Check whether `.spek/constitution.md` already exists (`Glob` on `.spek/constitution.md`).
   - If it exists, read the current content and treat this invocation as an incremental revision.
   - If it does not exist, it is created from scratch in step 2.

2. Invoke the `spek:sdd-templates` skill (`Skill` tool). When creating from scratch, scaffold the
   file with its script:

   ```bash
   ${CLAUDE_PLUGIN_ROOT}/skills/sdd-templates/scripts/scaffold.sh constitution
   ```

   It creates `.spek/` if needed and writes `.spek/constitution.md` with the header filled and the
   section structure in place. When revising, keep the existing file: no scaffold, edit in place.

3. Extract principles from the user argument: `$ARGUMENTS`. If it is empty, ask objective questions
   (via `AskUserQuestion`, grouped by theme, with concrete options whenever applicable) about:
   - Mandatory architecture patterns (e.g. layering, module boundaries)
   - Naming and code organization conventions
   - Testing policies (minimum coverage, mandatory test types)
   - External dependency constraints
   - Documentation policy (what must be documented when it changes, and where)
   - Security and data constraints (data handling, secrets, access rules)
   - Quality criteria that block a merge

   Every theme question offers "Recommend criteria for me" as one of its options, and the user may
   also ask for a recommendation in free text at any point. When they do, inspect the repository
   first (`Glob`/`Grep`/`Read` on dependency manifests, lint and formatter configs, CI workflows,
   the test directory and runner, the docs directory, auth and logging code) and derive 2 to 4
   candidate principles for that theme from what you found -- each one objectively verifiable and
   each one naming the evidence it came from (e.g. "80% line coverage on changed files -- the
   repo already enforces this in `jest.config.js`"). Present them through `AskUserQuestion` for
   the user to select; a recommendation is never written into the constitution without that
   selection. When the repository holds no evidence for a theme, say so and offer the common
   baselines for that theme instead, labelled as such.

4. Vagueness check, BEFORE writing anything: for each principle extracted in step 3, try to restate
   it in an objectively verifiable form. A principle passes only if a reviewer could answer
   "does this code comply?" with yes or no. If the input is too vague to restate that way (e.g.
   "clean code", "well tested", "good architecture"), do NOT fill the gap with a plausible
   interpretation -- ask the user via `AskUserQuestion`, offering 2 to 4 concrete candidate
   restatements as options (e.g. "well tested" -> "every public function has a unit test covering
   the happy path and at least one error case" / "minimum 80% line coverage on changed files" /
   "integration tests required for every API endpoint"). This mirrors the `[NEEDS CLARIFICATION]`
   discipline of specs: ambiguity is resolved by the user, never assumed.

5. Fill `.spek/constitution.md` in place with `Edit`/`MultiEdit`, replacing every placeholder with
   the collected principles (a finished constitution has no `[PLACEHOLDER]` left). Every principle
   must be objectively verifiable (avoid vague phrases such as "clean code"; prefer "every public
   function must have a unit test covering the happy path and at least one error case").

6. At the end, report the path of the created/updated file and list the principles as a numbered
   bullet list, so the user can confirm them before moving on to `/spek:specify`.

## Rules

- Never silently overwrite an existing constitution: always show the conceptual diff (what changes)
  before writing.
- The constitution is the only phase-0 artifact and does not belong to any specific feature -- it
  lives at `.spek/constitution.md`, outside `.spek/specs/`.
- This command runs only when the user invokes it directly or through `/spek:start` (which asks
  before creating a missing constitution). Never trigger it proactively in ordinary conversation.
- The constitution is written in English, whatever language the user answered in; the questions
  themselves go in the user's language.
- A recommended principle is a proposal, not a decision: it is grounded in repository evidence
  (or explicitly labelled as a common baseline when there is none) and enters the constitution
  only after the user selects it.
