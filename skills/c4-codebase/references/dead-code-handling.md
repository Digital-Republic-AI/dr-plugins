# Dead, Obsolete, and Unreachable Code Handling

Architecture discovery must distinguish "exists in the repository" from "participates in the running system".

## Evidence of participation

Look for reachability through:

- runtime entrypoints;
- imports and references;
- dependency injection or registration;
- route registration;
- event and queue handler registration;
- scheduler configuration;
- build inclusion;
- deployment inclusion;
- framework discovery conventions;
- reflection and dynamic loading;
- configuration-driven module loading;
- integration or end-to-end tests exercising the path;
- user confirmation.

## Reachability codes

These seven codes are the only vocabulary. They are stored in `units[].reachability` (`workspace.py unit set --reachability`) and in hypotheses (`hypothesis add --reachability`).

| Code | Meaning | Architecture treatment |
|---|---|---|
| `active` | strong direct runtime evidence | may enter the C4 model when architecturally relevant |
| `likely_active` | indirect but consistent evidence | may enter the model; confidence decides the `Inferred` tag |
| `uncertain` | insufficient evidence either way | keep out of the model when it would mislead; record it prominently in CONCERNS and ask when it changes the architecture |
| `test_build_tooling` | not part of the production runtime | STRUCTURE and TESTING only |
| `generated_vendor` | derived or third-party code | document only when it forms a deployed boundary or an important external dependency |
| `suspected_dead` | evidence suggests non-participation | CONCERNS only, never the active model |
| `obsolete_confirmed` | confirmed as legacy or unused by the user | CONCERNS only, never the active model |

## Whole-scope units

A unit whose path is the repository root (`.`) or the whole scope has one reachability code for everything inside it, so plugins, legacy folders, and generated code need their own classification. Record one hypothesis per architecture-relevant area, with evidence and `--reachability`. While such a unit exists, `hypothesis add` rejects hypotheses of that unit, or without a unit, that omit `--reachability`, and `validate` reports existing ones. Prefer registering deployable areas as separate units during partitioning.

## Safety rule

Static reachability is incomplete in dynamic, plugin-based, or reflection-heavy systems. Absence of imports is not enough to classify code as `suspected_dead`; use `uncertain` and a `dynamic_loading` question instead.

## Refactoring signal

Suspected dead code is a by-product of discovery. Do not delete or refactor it unless the user separately requests implementation work.
