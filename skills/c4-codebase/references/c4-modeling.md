# C4 Modeling Guidance

C4 is a hierarchy for communicating architecture, not a requirement to draw four diagrams for every repository.

## Level selection

### System Landscape
Use when the discovery scope contains multiple meaningful software systems and the wider landscape adds value.

### System Context
Usually valuable. Show the system under study, important people and roles, and external software systems.

### Container
Usually the most important reverse-engineering view. Show independently runnable or deployable applications and services, and architecturally important stores and queues.

### Component
Use selectively for complex or central containers. Components represent cohesive responsibilities, not every directory or class.

### Code
Do not generate by default. Use package or class detail only when it solves a specific communication need.

### Deployment
Use when topology and infrastructure materially affect the architecture and are supported by deployment evidence: a deployment descriptor, infrastructure code, a pipeline that publishes to an environment, or the user's confirmation that a specific environment already runs this code. A confirmed plan is not deployment evidence: a topology that documents or people describe as intended goes to ARCHITECTURE and CONCERNS as "planned, not implemented", never into `workspace.dsl`. Without deployment evidence, leave the view out and state the unknown.

### Dynamic
Use for high-value end-to-end workflows where ordered interactions explain behavior better than another structural view.

## Boundary decisions

A repository is not automatically a Software System. It may be a service inside a broader system or a monorepo containing several systems.

Ask when ownership or system boundaries cannot be established from code or configuration.

Managed resources such as S3, Redis, EventBridge, databases, queues, or gateways may be inside or outside the system boundary depending on ownership and how the team reasons about them.

### Several repositories and submodules

- One workspace per repository. When the system spans repositories, model this repository's containers and show sibling repositories as software systems tagged `External`, named as the user confirms.
- Git submodules are external systems unless the user includes them in scope; their content is not scanned.
- Record the boundary decision as a question answer so later runs keep it.

## Container rules

Good candidates:

- web application;
- API or service;
- worker or scheduler;
- independently deployed serverless group;
- database;
- queue or event bus where architecturally central;
- search engine or object store where architecturally central.

Avoid confusing shared libraries or packages with Containers.

## Relationship rules

Relationships have meaningful verbs, a purpose, and a direction. Include technology or protocol where known.

Prefer:

- "Submits orders via HTTPS"
- "Publishes fulfillment jobs via AMQP"
- "Reads customer records using JDBC"

Avoid bare "uses" arrows when a more specific interaction is known.

## Modeling uncertainty

Apply this table to every element and relationship. Confidence and status come from the hypothesis ledger; reachability from the unit or hypothesis.

| Hypothesis status and confidence | Reachability | In workspace.dsl | In Markdown | Follow-up |
|---|---|---|---|---|
| `confirmed`, any confidence | `active` or `likely_active` | modeled normally | label `[confirmed q-NNN]` or `[confirmed hyp-NNN]` | none |
| `inferred`, `high` | `active` or `likely_active` | modeled normally | label `[inferred hyp-NNN high]` | none |
| `inferred`, `medium` | `active` or `likely_active` | modeled with the `Inferred` tag | label with confidence; exporters drop the dashed style | ask only if it changes the architecture |
| `inferred`, `low` | any | not modeled | CONCERNS, low-confidence claims | `question add` when architecture-changing |
| any unconfirmed | `uncertain` | not modeled | CONCERNS | `question add --impact dynamic_loading` or `runtime_topology` |
| any | `suspected_dead` or `obsolete_confirmed` | not modeled | CONCERNS, suspected dead or obsolete code | none |
| any | `test_build_tooling` or `generated_vendor` | only when it is a real deployed boundary or an important external dependency | STRUCTURE or TESTING | none |

A `rejected` hypothesis never appears in the model.

A `user_confirmation` confirms what the user says exists, not what they would like drawn. Phrase `runtime_topology` and `system_boundary` questions as "does this exist today, and where" rather than "which option should the view show"; when the answer is a plan or a preference, record it as intent evidence for the prose and keep the model unchanged.

## Stable identifiers

Choose deterministic, descriptive identifiers and preserve them across updates. Avoid identifiers based on transient directory numbering.
