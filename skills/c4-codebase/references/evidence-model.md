# Evidence, Inference, and Confirmation Model

Architecture discovery must preserve why a claim exists. Records follow `schemas/evidence.schema.json`, `schemas/hypothesis.schema.json`, `schemas/question.schema.json`, and `schemas/checkpoint.schema.json`. Write them with `workspace.py`; `workspace.py validate` enforces the schemas and every cross-reference.

## Claim classes

### Observed
Directly supported by repository content, git metadata, deployment or configuration files, or deterministic command or tool output. Stored in `evidence.jsonl`.

### Inferred
A semantic conclusion derived from one or more observations. Stored in `hypotheses.jsonl` with at least one evidence id and a confidence.

### Confirmed
A fact explicitly confirmed by the user (the answer becomes `user_confirmation` evidence through `question answer`) or by a clearly authoritative project source (`documentation` evidence). The hypothesis receives a revision with `status: confirmed`.

## Confidence

`high`, `medium`, or `low`. Confidence is qualitative, not a probability.

- `high`: multiple consistent direct signals, little plausible alternative;
- `medium`: reasonable conclusion from incomplete or indirect signals;
- `low`: plausible, but architecture-changing ambiguity remains.

How confidence reaches the model: the uncertainty table in `references/c4-modeling.md`.

## Evidence kinds

`source`, `config`, `deployment`, `documentation`, `command`, `tool`, `git`, `user_confirmation`.

- `source`, `config`, `deployment`, and `documentation` need a `path` that exists in the working tree; use `git` for files that only exist in history.
- `command` needs the `command` string; record DSL validation and other checks this way.
- Intent documents (README, PRD, design notes, ADRs, API specifications that describe intended behavior) are recorded as `kind: documentation` with `intent: true`. There is no other label for them. Never upgrade intent to runtime fact without implementation or deployment corroboration.

## Record examples

Evidence, as written by `evidence add`:

```json
{"id":"ev-001","kind":"source","intent":false,"path":"src/api/server.ts","lines":"12-38","command":null,"observation":"Creates an HTTP server and registers API routes","unit":"api","questionId":null,"repositoryRevision":"abc123","dirty":false,"fingerprint":"9f86d081884c7d65","supersedes":null,"capturedAt":"2026-09-14T22:00:00+00:00"}
```

Hypothesis:

```json
{"id":"hyp-001","claim":"api is an independently deployable backend container","evidence":["ev-001","ev-014"],"confidence":"high","status":"inferred","unit":"api","reachability":"active","questionIds":[],"supersedes":null,"recordedAt":"2026-09-14T22:05:00+00:00"}
```

Question:

```json
{"id":"q-003","question":"Is the legacy SOAP client still loaded in production?","impact":"dynamic_loading","status":"open","unit":"api","hypothesisIds":["hyp-001"],"answer":null,"answerEvidence":null,"dismissalReason":null,"supersedes":null,"recordedAt":"2026-09-14T22:10:00+00:00"}
```

## Append-only rules

- Ledgers are never rewritten. The only exception is redacting a leaked secret.
- Evidence is immutable and its ids are unique. A correction is a new record with `supersedes` naming the corrected id.
- A hypothesis or question changes state through a revision: a new line with the same id and the same claim or question text (`hypothesis revise`, `question answer`, `question dismiss`). The latest line for an id is its current state; earlier lines are history.
- A different claim or question gets a new id with `supersedes` naming the replaced id. Superseded ids leave the effective view but keep their provenance.
- `supersedes` must reference an earlier record.

## Secrets

Never record secret values in ledgers, checkpoints, perspectives, the model, or published documents. Record the key name and where it is read, for example "DATABASE_URL is read in config/db.ts". `workspace.py` rejects probable secrets on input. `validate` reports any that slipped into ledgers, checkpoints, working documents (inventory, perspectives, model), or published documents, and `publish-check` reports them in published documents. Redact them in place and run `validate` again.

## Tool evidence

Output from scanners, static analyzers, dependency graphs, or code property graphs is `tool` evidence. Its semantic meaning may still require inference.

## Evidence granularity

Prefer atomic observations. "The system is microservices" is not an observation. "Three independently deployed services are defined in Helm and communicate over HTTP" decomposes into verifiable observations from which a pattern may be inferred.
