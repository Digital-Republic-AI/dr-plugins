# Inquiry Checkpoints

Use these questions as completion criteria for working documents and investigation units. Not every question applies to every repository. Record non-applicable items implicitly by context rather than manufacturing content.

## Contents

- STACK
- STRUCTURE
- ARCHITECTURE
- CONVENTIONS
- INTEGRATIONS
- TESTING
- CONCERNS
- C4 synthesis checkpoints

## STACK

- Which languages and versions are evidenced?
- Which runtimes and frameworks are production dependencies?
- Which dependency/build/package managers are used?
- Which databases, caches, queues, streams, search engines, and object stores are evidenced?
- Which cloud/platform services appear in production paths?
- Which tooling is development-only?
- Are multiple stacks present across workspaces/services?

## STRUCTURE

- Is this a monorepo, single application, service, library, infrastructure repo, or hybrid?
- Which folders are deployable/runnable units?
- Which folders are shared libraries?
- Which entrypoints start production execution?
- Which areas are generated, vendored, test-only, build-only, or examples?
- How do path aliases/workspaces map imports to real locations?
- What are the bounded investigation units?

## ARCHITECTURE

- What is the repository/system scope?
- What runtime units exist?
- What responsibilities does each runtime unit own?
- What are the main inbound interfaces and triggers?
- What are the main outbound interactions?
- What architectural patterns are actually evidenced?
- Are there hybrid patterns, circular dependencies, layer violations, or boundary leakage?
- What synchronous and asynchronous data flows exist?
- Which system boundaries are observed versus inferred?

## CONVENTIONS

- What naming and folder conventions recur?
- How are dependencies created/injected/resolved?
- How are errors represented and propagated?
- How are configuration and secrets accessed? Record key names and access paths only, never values.
- How are interfaces/adapters/repositories/services/controllers typically organized?
- How are imports/module boundaries enforced?
- Are architectural constraints automated by linting/build/tests?

## INTEGRATIONS

- Which databases are used and by which runtime units?
- Which external APIs/services/providers are called?
- Which inbound APIs/webhooks/interfaces are exposed?
- Which auth/identity providers participate?
- Which queues/topics/event buses have producers and consumers?
- Which schedulers/jobs exist?
- Which protocols and data formats are visible?
- Which observability/notification/payment/storage services matter architecturally?
- Are integrations production, optional, legacy, or test-only?

## TESTING

- Which test frameworks and test levels exist?
- Where are unit/integration/e2e/system tests located?
- Which runtime contracts are evidenced by integration tests?
- Which external systems are mocked versus exercised?
- Which fixtures/test containers reveal database/queue/service dependencies?
- Are there architecture tests or dependency-boundary tests?
- Which TODOs are testing gaps rather than production debt?

## CONCERNS

- Which documentation conflicts with implementation?
- Which files/modules have high churn or unusually large complexity signals?
- Which dependencies appear unused or obsolete?
- Which code is possibly unreachable/dead?
- Which circular dependencies or layer violations exist?
- Which integration points lack resilience or clear ownership?
- Which security/configuration risks are architecture-relevant?
- Which runtime claims remain low-confidence?

## C4 synthesis checkpoints

### System Context
- Is the system boundary explicit?
- Are actors evidenced or confirmed?
- Are external systems important enough to show?
- Do relationships express purpose rather than generic "uses"?

### Container
- Are containers runnable/deployable units rather than arbitrary packages?
- Are databases/queues/stores included only when architecturally useful?
- Are protocols/directions supported by evidence?

### Component
- Does the selected container benefit from component decomposition?
- Are components responsibility-oriented rather than folder dumps?
- Are internal relationships useful to the intended audience?

### Deployment
- Is production topology supported by deployment/IaC/config evidence or explicit confirmation?
- Are managed services represented at the correct boundary?

### Dynamic
- Is there a high-value workflow whose ordered interactions are not clear from structural views?
