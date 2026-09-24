# Stack Detection

Load this reference when multiple manifests, unfamiliar files, generated manifests, or monorepo layout make the stack ambiguous.

## Detection precedence

1. production dependency manifests and lockfiles;
2. executable entrypoints and framework bootstrap;
3. build configuration;
4. deployment/container configuration;
5. source file distribution;
6. documentation as corroborating evidence only.

## Production vs development

Do not list linters, formatters, test runners, code generators, or build tools as production runtime technology unless deployment evidence shows they execute in production.

## Multi-stack repositories

Represent stack by investigation unit, using the "Stack by investigation unit" table in `perspectives/stack.md`, rather than flattening everything into one list. A React frontend and Go API are separate runtime technology profiles even if they share a monorepo.

## Ambiguity

When two plausible runtime stacks coexist, record both as observed and delay the conclusion until entrypoint/deployment evidence resolves which is active.
