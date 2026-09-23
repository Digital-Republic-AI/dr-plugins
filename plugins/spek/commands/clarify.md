---
description: Resolves [NEEDS CLARIFICATION] markers in an existing spec through objective questions
argument-hint: "[NNN-slug of the feature, or empty to use the most recent feature]"
allowed-tools: Read, Write, Edit, Glob, Grep, AskUserQuestion, Bash(${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh:*)
---

# Clarify

## Steps

1. Resolve the target feature: if `$ARGUMENTS` was provided, use it as the slug; otherwise, find the
   most recent feature with `phase: "specify"` or `phase: "clarify"` in `state.json`
   (`Glob: .spek/specs/*/state.json`, ordered by `updated` desc). This is the "current feature"
   rule of `conventions.md`, section "Navigation", narrowed to the phases clarify can act on.

2. Read `.spek/specs/NNN-slug/spec.md` and extract every `[NEEDS CLARIFICATION: ...]` marker.

3. Delegate the elicitation to the `spek:spec-clarifier` subagent: it converts each marker into an
   objective multiple-choice question (when applicable) or a short open question, asks the user
   directly via its own `AskUserQuestion` tool, and returns the resolved decisions (marker,
   question, answer). The subagent never edits the spec -- applying the answers is this command's
   job.

4. Fallback: if the subagent returns unanswered questions (its `AskUserQuestion` was unavailable in
   the session), present them to the user yourself -- via this command's `AskUserQuestion` or, when
   that is also unavailable, as plain text -- and collect the answers before proceeding. Never
   proceed with an unanswered marker.

5. For each decision obtained, edit `spec.md` replacing the `[NEEDS CLARIFICATION: ...]` marker with
   the decision that was made, and record the decision (question + answer) in a `## Clarifications`
   section at the end of the spec, with a timestamp. Both the replacement and the record are
   written in English, whatever language the user answered in.

6. Advance the state by running `${CLAUDE_PLUGIN_ROOT}/scripts/update-state.sh .spek/specs/NNN-slug set-phase clarify`.
   The script sets `phase`, appends to `history`, and refreshes `updated` with a real timestamp --
   never hand-edit `state.json`.

7. At the end, confirm that no `[NEEDS CLARIFICATION]` markers remain in the spec (run `Grep` to
   validate) before suggesting `/spek:plan` as the next step.

## Rules

- Never invent an answer for a `[NEEDS CLARIFICATION]` marker -- always ask the user.
- If the spec has no pending markers, report that and suggest skipping straight to `/spek:plan`.
- Questions must be specific to the feature's domain, never generic (avoid "which technology should
  we use" without context -- prefer "Should authentication use OAuth via Google, email/password, or
  both?").
