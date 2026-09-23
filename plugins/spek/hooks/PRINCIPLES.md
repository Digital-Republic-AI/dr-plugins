# SDD Principles

Operating principles for every /spek command and subagent in this session. They encode the
practices this plugin is built on; when in doubt, they win over convenience.

## Artifacts over memory

- The spec is the source of truth for a feature; code is derived output. When code and spec
  disagree, that is a finding to surface, never something to silently reconcile.
- Never rely on conversation memory to know where a feature stands: read the feature's state file
  (and, as fallback, the physical artifacts) before acting. Any session must be able to resume
  from disk.
- The state file and feature numbering are managed ONLY through the plugin's deterministic helper
  scripts -- never hand-edited, never computed by model judgment.

## Ambiguity is resolved, never assumed

- A gap in the user's input becomes an explicit `[NEEDS CLARIFICATION: ...]` marker, and a gap in
  what code reveals becomes `[CANNOT INFER: ...]` -- never a plausible-sounding guess. An honest
  gap is useful; an invented fact poisons every later phase.
- Decisions belong to the user: clarification answers, mode downgrades to `light`, constitution
  principles, and scope changes are always confirmed, never applied silently.

## Specs stay narrow

- A spec describes ONE change, in 1-3 pages: what changes, what must be preserved, what is out of
  scope. A spec that tries to describe the whole system has failed -- narrow the scope instead.
- Specify answers "what" and "why"; the plan answers "how". Stack, libraries and architecture
  never leak into a spec; product decisions never leak into a plan.

## Evidence over claims

- Nothing is "done" or "met" without evidence produced in this run: a file:line reference or
  captured command output. "It looks correct" is not a verification result.
- Task progress is derived from the task-list artifact (its checkbox counts), never from memory
  or increments. Verification always runs, in every mode.

## Phase discipline and proportionality

- Phases advance in order and each one has prerequisites; the gates exist to be respected, not
  bypassed. When a prerequisite is missing, stop and point to the command that fulfills it.
- Process must earn its overhead: trivial changes take the light path, large ones the full
  pipeline. Skipping phases is a user decision; adding unrequested process is scope creep.
- Each phase gets a fresh, narrow context (its own subagent with restricted tools). Long, mixed
  contexts degrade instruction compliance.

## Existing code is respected

- In brownfield work, describe what the code DOES, not what it should do. Judgments and
  refactoring ideas belong to the change spec, never to the baseline.
- What the spec does not explicitly change must be preserved -- and preservation is verified
  against the baseline, not assumed from good intentions.

## One language for artifacts, the user's for the conversation

- Every artifact the plugin writes (constitution, baseline, spec, plan, tasks, verify report,
  research, `state.json` notes) is in English, whatever language the user writes in. Identifiers
  and status labels stay literal. Only text a template records verbatim as user input is kept as
  given.
- The conversation follows the user: questions, notices and summaries in the language they used.
