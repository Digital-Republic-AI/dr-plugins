# Baseline: [SCOPE NAME]

**Extracted from**: `[path/to/module]` (list every path in scope)
**Extracted on**: [DATE]
**Files analyzed**: [N]
**Status**: Draft

<!--
This is the retroactive specification of the CURRENT behavior of existing code -- the baseline
that later phases consume. It describes what the code DOES today, never what it should do.
No judgments, no improvement suggestions, no refactoring notes.

Every claim must be traceable to a file and line that was actually read. Whenever behavior
cannot be determined with confidence from the code alone, write
`[CANNOT INFER: specific reason]` instead of a plausible guess, and repeat that marker in the
`## Inference Gaps` section at the end.
-->

## Responsibilities

<!--
What this code does, as numbered BR-00X entries (Baseline Requirement). Each entry must be
objectively stated, because these become preservation criteria for the change that follows:
/spek:specify can promote a BR-00X into a `PR-00X` entry of `### What Must Be Preserved`, and
/spek:verify checks it with concrete evidence. If an entry cannot be confirmed by inspecting
code or running a command, rewrite it until it can.
-->

- **BR-001**: [Behavior the code exhibits today, stated so it can be objectively checked] (`[file:line]`)
- **BR-002**: [Behavior the code exhibits today, stated so it can be objectively checked] (`[file:line]`)
- **BR-00X**: [Behavior whose exact effect could not be determined] `[CANNOT INFER: specific reason]`

## Inputs and Outputs

<!-- The public contracts of this scope: what callers can invoke and what they get back. -->

### Entry Points

- **[function / class / endpoint / CLI command]** (`[file:line]`): [what invoking it does]

### Arguments and Parameters

- **[name]** ([type or "untyped"]): [meaning, required/optional, default as written in the code]

### Return Values

- **[entry point]**: [what it returns, including the shape of the value and the error/empty cases]

### Exit Codes

- **[code]**: [condition that produces it] <!-- omit this subsection if the scope is not a CLI/process -->

### Observable Effects on the Caller

- [Exceptions/errors raised and the conditions that raise them]
- [Anything the caller must do before or after calling -- an implicit contract; mark it
  `[CANNOT INFER: reason]` when the callers cannot be seen from this scope]

## Side Effects

<!-- Everything the code changes outside of returning a value. -->

- **State mutations**: [module-level/global/instance state written, and where] (`[file:line]`)
- **Files written**: [path or path pattern, mode, when] (`[file:line]`)
- **External calls**: [HTTP/database/queue/process calls, and the conditions that trigger them] (`[file:line]`)
- **Logging / telemetry**: [what is emitted and at which level] (`[file:line]`)

If the scope has no side effect of a given kind, write "None observed in the files analyzed."

## Dependencies

### Depends on (internal)

- `[module/path]`: [what is imported or called from it] (`[file:line]`)

### Depends on (external)

- `[package/service]`: [what is used from it, and the version constraint if declared] (`[file:line]`)

### Known dependents

<!--
What is known to depend on this code, found by searching the repository. This list is only as
complete as a static search can be: dynamic dispatch, reflection and runtime configuration can
hide callers. State that limit explicitly rather than implying the list is exhaustive.
-->

- `[module/path]`: [how it uses this scope] (`[file:line]`)
- [Callers reachable only dynamically] `[CANNOT INFER: specific reason]`

## Inference Gaps

<!--
MANDATORY section. List every `[CANNOT INFER: reason]` marker used above, with the section it
appears in and why the code alone was not enough (dynamic dispatch, reflection, external
configuration, unreachable-looking branch, implicit contract with an unseen caller, ...).
A gap is a finding, not a failure: an honest gap is useful, an invented fact poisons every
later phase.
-->

- **[Section] -- [subject]**: `[CANNOT INFER: specific reason]`
- **[Section] -- [subject]**: `[CANNOT INFER: specific reason]`

If there is none, state: "None -- but absence of gaps in a large scope is itself suspicious;
review carefully."
