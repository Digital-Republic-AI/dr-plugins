# Common TypeScript diagnostic codes

What a dominant code usually says about the state of a codebase, and the action that tends to clear it fastest. Use it to write the assessment paragraph; confirm against the actual messages and files in the JSON before stating a cause.

## Contents

- Configuration and environment (TS5xxx, TS6xxx, TS2307, TS2688, TS2792)
- Strictness migration (TS7xxx, TS2531/TS2532/TS18047/TS18048, TS2564)
- Type drift between code and types (TS2322, TS2339, TS2345, TS2353, TS2741, TS2554)
- Modules and declarations (TS2305, TS2614, TS7016, TS2300, TS2451)
- Reading the distribution

## Configuration and environment

| Code | Meaning | Usual cause | Action |
|------|---------|-------------|--------|
| TS5023, TS5025, TS5024 | Unknown or invalid compiler option | Option misspelled, or removed in the installed TypeScript version | Fix tsconfig first; nothing else is reliable until it parses |
| TS5101, TS5107 | Option deprecated | TypeScript upgrade (e.g. `importsNotUsedAsValues`, `target: ES3`) | Replace the option, or set `ignoreDeprecations` while migrating |
| TS6053, TS6059, TS6307 | File not found / outside rootDir / not in project | `include`, `rootDir` or project references out of sync with the tree | Align `include`/`rootDir`/`references` with the folders |
| TS2307 | Cannot find module | Dependency not installed, missing `@types`, wrong `paths`/`baseUrl`, or wrong `moduleResolution` | Install dependencies first; if it persists, check `paths` and `moduleResolution` |
| TS2688 | Cannot find type definition file | A name in `types` that is not installed | Install the `@types` package or remove it from `types` |
| TS2792 | Cannot find module, did you mean to set moduleResolution | `moduleResolution` not matching the bundler/runtime | Set `moduleResolution` to `bundler` or `node16`/`nodenext` |

Many TS2307 errors at once, across many files, almost always mean `node_modules` is missing or stale rather than broken code: run the package manager's install before anything else.

## Strictness migration

| Code | Meaning | Usual cause | Action |
|------|---------|-------------|--------|
| TS7006, TS7031, TS7005, TS7034 | Implicit any (parameter, binding, variable) | `noImplicitAny`/`strict` turned on over untyped code | Type the exported/public functions first; leaf files last |
| TS7053 | Element implicitly has any (index access) | Indexing an object with a `string` | Use `Record<K, V>`, `keyof typeof`, or an index signature |
| TS2531, TS2532, TS18047, TS18048 | Possibly null/undefined | `strictNullChecks` on | Narrow at the boundary (guards, early return) instead of `!` everywhere |
| TS2564 | Property has no initializer | `strictPropertyInitialization` on | Initialize in the constructor, or mark optional when it really is |
| TS18046 | Value is of type unknown | `useUnknownInCatchVariables` | Narrow `catch (error)` with `instanceof Error` |

A report dominated by this family means a strictness flag was recently enabled: it is a migration, not a set of bugs. Suggest doing it per folder (a tsconfig override or `// @ts-expect-error` budget) rather than file by file at random.

## Type drift between code and types

| Code | Meaning | Usual cause | Action |
|------|---------|-------------|--------|
| TS2322 | Type X is not assignable to type Y | A type or API changed and call sites did not follow; or real bugs | Group by target type: one changed interface often explains dozens |
| TS2339 | Property does not exist on type | Renamed/removed field, or a too-narrow type | Find the type definition that changed; fix it once |
| TS2345 | Argument not assignable to parameter | Function signature changed | Update the signature or the callers, starting from the most-called |
| TS2353, TS2561 | Object literal has unknown property | Extra field passed to a typed object, or a typo | Remove/rename the field, or widen the type deliberately |
| TS2741, TS2739 | Property missing in type | Required field added to a type | Make it optional or fill it at the construction sites |
| TS2554, TS2555 | Wrong number of arguments | Signature changed | Same as TS2345 |

When one or two files concentrate these codes, the cause is usually a single shared type (API client, generated types, a store) that changed: regenerate or update it before touching the consumers.

## Modules and declarations

| Code | Meaning | Usual cause | Action |
|------|---------|-------------|--------|
| TS2305, TS2614 | Module has no exported member | Library upgrade changed exports, or default vs named import mix-up | Check the library's changelog; fix the import style |
| TS7016 | Could not find a declaration file | Untyped JS dependency | Install `@types/<pkg>` or add a local `declare module` |
| TS2300, TS2451 | Duplicate identifier / redeclared block variable | Two versions of the same `@types`, or scripts sharing a global scope | Deduplicate dependencies; add `export {}` to make files modules |
| TS1259, TS1192 | Module can only be default-imported with esModuleInterop | Interop flags | Enable `esModuleInterop` or use `import * as` |

## Reading the distribution

- **Concentrated** (a few files hold most errors): a local problem; fix those files or the type they share.
- **Spread with one dominant code**: a systemic cause (config, missing install, a strictness flag, a changed shared type); one fix clears many.
- **Spread with many codes**: accumulated debt; suggest gating new errors in CI first, then burning down by folder.
- **Global diagnostics only** (no file): the configuration does not parse; nothing else in the report is meaningful until it is fixed.
- **Zero diagnostics with a failing exit code**: the command did not run tsc to completion; the raw output says why.
