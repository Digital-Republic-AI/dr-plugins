# Validation and Completion Criteria

Validation is a loop: run the executable checks, fix every error, and repeat until they pass; then review the checklists. Never mark a phase complete while a check fails.

## Executable checks

| Check | Command | Pass condition |
|---|---|---|
| State, ledgers, references, reachability, secrets, claim labels, questions.md | `${CLAUDE_SKILL_DIR}/scripts/workspace.py validate --repo . --json` | exit 0 and `valid: true` |
| DSL shape, identifiers, relationships, views, dynamic steps, instances, styles (offline) | `${CLAUDE_SKILL_DIR}/scripts/dsl.py lint --workspace .c4-codebase/model/workspace.dsl --json` | exit 0 and `valid: true`; also part of `validate` (`errors.dsl`) |
| DSL syntax | `${CLAUDE_SKILL_DIR}/scripts/export-diagrams.sh --workspace <workspace>/model/workspace.dsl --validate-only` | exit 0; exit 5 means tooling is missing, so record the skip |
| Publication safety | `${CLAUDE_SKILL_DIR}/scripts/workspace.py publish-check --repo . --json` | exit 0 before writing; after writing `published: true` and empty `staleFiles`, `secretFindings`, and `claimLabelErrors` |

Record the DSL result (passed, failed, or skipped) as `command` evidence. The `validation` phase cannot be completed while `validate` fails. `[TODO]` and `[ASK USER q-NNN]` are defined in SKILL.md ("Claim labels and markers").

## Working-document validation

For each perspective document:

- required core sections are populated or explicitly marked `[TODO]`;
- non-trivial claims carry claim labels whose ids exist in the ledgers and match the label (`validate` checks both);
- intent-dependent gaps are `[ASK USER q-NNN]` backed by an open question;
- unknown implementation facts are `[TODO]`, never guessed;
- claims about changed paths are superseded or rechecked after `invalidate`;
- no secret values appear anywhere.

## Architecture validation

- scope is explicit;
- observed, inferred, and confirmed claims are distinguishable in narrative documents;
- runtime units have deployment or entrypoint evidence, or confirmation;
- packages and libraries are not mislabeled as deployable Containers;
- external systems are distinguished from owned runtime elements;
- relationship direction and purpose are meaningful;
- protocols and technologies are included only when known;
- no `suspected_dead` or `obsolete_confirmed` code is represented as active architecture;
- important data stores, queues, and events are neither omitted nor over-modeled;
- pattern labels are supported by structural or dependency evidence;
- elements and relationships follow the uncertainty table in `references/c4-modeling.md`.

## C4 view validation

- System Context answers who and what interacts with the system;
- the Container view reflects runnable or deployable topology;
- Component views are selective and responsibility-oriented;
- Deployment views reflect real topology rather than assumptions;
- Dynamic views correspond to real workflows;
- diagrams avoid box-and-arrow soup.

## Structurizr validation

- stable identifiers;
- descriptions and technologies where appropriate;
- labeled relationships;
- appropriate views;
- auto layout or an explicitly maintained layout;
- DSL validation passed, or its skip is recorded under validation gaps in CONCERNS.

## Intent vs reality

List material divergences between README, design, or PRD claims and implementation or deployment evidence.

## Final user review

Present only architecture-changing open questions, numbered, in one batch of 3 to 7. After the answers:

1. `question answer` (creates confirmation evidence) or `question dismiss`;
2. `hypothesis revise` for affected hypotheses, or new hypotheses with `supersedes`;
3. regenerate affected documents and views;
4. rerun the executable checks.

## Completion definition

Mark the analysis complete with `phase set --phase complete --status complete` only when:

- every phase gate passed (references/state-machine.md);
- remaining unknowns are explicit and non-blocking;
- published documents are coherent and start with the generated header;
- the canonical `workspace.dsl` is internally consistent and validated, or its skip is recorded;
- `validate` exits 0.
