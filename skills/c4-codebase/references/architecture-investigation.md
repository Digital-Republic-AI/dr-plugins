# Architecture Investigation

This reference expands the semantic analysis beyond C4 boxes so the resulting model reflects implementation reality.

## Architecture pattern detection

Inspect:

- folder/module organization;
- dependency direction;
- interface/abstraction boundaries;
- runtime communication;
- dependency injection and registration;
- domain/application/infrastructure separation;
- event publication/consumption;
- deployment boundaries.

Possible patterns include layered, modular monolith, microservices, hexagonal/ports-and-adapters, clean architecture, MVC/MVVM, event-driven, serverless, plugin architecture, or hybrids.

Never select a pattern because folder names resemble one. Document adaptations and violations.

## Runtime building blocks

Identify web frontends, APIs, workers, CLI processes, scheduled jobs, serverless functions, databases, queues, streams, caches, search, object storage, gateways, and external SaaS dependencies.

For C4, a Container is a runnable/deployable unit or data store, not necessarily a Docker container.

## Interaction analysis

For each interaction, capture where possible:

- source and destination;
- purpose;
- initiator/direction;
- synchronous/asynchronous behavior;
- transport/protocol;
- authentication/trust boundary;
- failure/resilience behavior when architecturally meaningful.

## Layer and dependency analysis

Map implemented layers and dependency rules. Note:

- abstraction mechanisms;
- dependency inversion;
- circular dependencies;
- boundary violations;
- shared libraries coupling multiple deployables;
- hidden cross-layer access.

## Data architecture

Investigate:

- domain/entity model boundaries;
- databases and ownership;
- repositories/data mappers/ORM;
- migrations and schema management;
- caching;
- transaction boundaries;
- data transformation/mapping;
- event/message schemas;
- shared-database coupling.

## Cross-cutting concerns

Document architecture-relevant implementation of:

- authentication and authorization;
- configuration and secrets (key names and access paths only, never values);
- logging, metrics, tracing, monitoring;
- error handling and resilience;
- validation;
- feature flags;
- rate limiting;
- caching;
- background processing.

## Technology-specific interpretation

Use framework conventions only after detecting the framework. Examples:

- Spring/Java: application bootstrap, DI, transactions, JPA/ORM, controllers;
- .NET: host model, middleware, DI, EF/data access, controllers/minimal APIs;
- React/Angular: component boundaries, routing, state, data fetching;
- Python: package layout, framework bootstrap, sync/async model;
- Node.js: package/workspace boundaries, framework bootstrap, module resolution, worker/queue patterns;
- Go: commands/packages, interface boundaries, HTTP/gRPC handlers, goroutine/worker topology.

## Deployment architecture

Derive only from deployment evidence or confirmation. Inspect environments, containers, orchestration, serverless definitions, cloud services, runtime replicas, gateways, managed databases, and environment-specific configuration.

## Evolution and extensibility

When useful, document real extension points: plugin registries, interfaces, adapters, configuration-driven strategies, event consumers, feature modules. Do not fabricate "recommended" extension points during discovery unless clearly marked as recommendations.
