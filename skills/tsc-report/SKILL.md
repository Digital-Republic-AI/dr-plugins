---
name: tsc-report
description: Runs the TypeScript type checker (tsc, vue-tsc or the project's typecheck script), saves the raw output to ./tsc-reports/<timestamp>/, writes two grouped JSON reports (errors by TS code and errors by file), shows the result as tables and closes with one paragraph assessing the current state of the code base and the action to take next. Use it whenever the user asks to run tsc or the type check, wants to know how many TypeScript errors there are, where they concentrate or which ones dominate, wants a type-error report or snapshot, or plans a strict-mode or TypeScript upgrade cleanup - even without saying "report", e.g. "roda o tsc", "quantos erros de tipo tem", "como está o typecheck", "onde estão os erros de TypeScript", "relatório do tsc". Not for fixing the errors themselves, unless the user asks for it after seeing the report.
license: MIT
compatibility: Requires Node.js 18+ and a TypeScript type checker (the project's own install or a global tsc).
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/*), AskUserQuestion
disable-model-invocation: true
metadata:
  version: "1.0.0"
---

# TypeScript type-check report

The point of this skill is a diagnosis the user can act on, not a dump of compiler output. tsc prints errors in file order, which hides what matters: whether a handful of causes explain most of the errors. The bundled script does the mechanical part (run, persist, parse, group); your part is choosing the right command and reading the numbers.

Talk to the user in their language (Portuguese with full diacritics when they write in Portuguese). No emojis.

## Script

`scripts/tsc-report.mjs` (Node 18+, no dependencies). Run it from the project root; `<skill>` below is this skill's directory (`${CLAUDE_SKILL_DIR}`). When several targets need a choice, ask with AskUserQuestion.

| Subcommand | What it does |
|------------|--------------|
| `node <skill>/scripts/tsc-report.mjs detect` | Prints JSON: package manager, local TypeScript version, `package.json` scripts that call tsc/vue-tsc/svelte-check, every `tsconfig*.json` (solution-style or not), workspaces, and suggested commands |
| `node <skill>/scripts/tsc-report.mjs stamp` | Prints a timestamp in the report folder format (`2026-11-05_14-30-12`), to share one folder across several runs |
| `node <skill>/scripts/tsc-report.mjs run [--cwd DIR] [--label NAME] [--stamp STAMP] -- <command>` | Runs the command, writes `tsc-output.txt`, `errors-by-code.json` and `errors-by-file.json` to `./tsc-reports/<stamp>/[<label>/]`, and prints a Markdown summary with both tables |
| `node <skill>/scripts/tsc-report.mjs parse --input FILE [--label NAME]` | Same report from an existing tsc output file, without running anything |

Both JSON files share a `meta` block (command, cwd, stamp, exit code, duration, TypeScript version and whether it is the project's own or a global install, totals, warnings, notes) and hold `groups` sorted by count: per code, the files it touches and every occurrence; per file, its codes and every occurrence with line and column. The raw output is kept so nothing is lost if the parser misses a line.

The script never needs colors or `--pretty false`: it reads both tsc formats and disables colors itself.

## Workflow

### 1. Choose the command

Run `detect` first. Prefer the project's own command, because it carries the flags and the project selection the team actually uses:

1. A `package.json` script that runs the type checker (`typecheck`, `type-check`, `tsc`, `check-types`), run through the detected package manager (`pnpm run typecheck`, `npm run typecheck`).
2. Otherwise `npx tsc --noEmit -p tsconfig.json` for the root tsconfig.
3. For a solution-style tsconfig (only `references`, empty `files`), `npx tsc -b`, since `--noEmit -p` on it checks nothing. Mention that `-b` may write `.tsbuildinfo` files.

Avoid a script that also runs other tools (`tsc && eslint`, `build`): their output is noise and a build has side effects. If the only candidate is like that, use the direct tsc command instead and say why.

When `detect` reports `multipleTargets` (several tsconfigs that are not just `extends` bases, or workspaces), list the candidates in one short question and let the user pick one, several or all. Bases such as `tsconfig.base.json` that other configs extend are not targets on their own. For several targets, get one stamp first and pass it to every run, with a `--label` per target (the folder or tsconfig name), so they land side by side in one timestamp folder:

```bash
STAMP=$(node <skill>/scripts/tsc-report.mjs stamp)
node <skill>/scripts/tsc-report.mjs run --cwd packages/api --stamp "$STAMP" --label api -- npm run typecheck
node <skill>/scripts/tsc-report.mjs run --cwd packages/web --stamp "$STAMP" --label web -- npm run typecheck
```

Do not make up a stamp by hand: a different format breaks the ordering of the folders and the comparison with earlier runs.

When `typescript.source` is `global`, the run uses whatever tsc is installed on this machine, not a version pinned by the project; mention it in the totals line, since another machine may report different errors. If TypeScript is not installed locally (`typescript.installed: false`) and `node_modules` is missing, say so: the run will mostly report TS2307 (cannot find module), which is an install problem, not a code problem. Offer to install dependencies first; run anyway if the user prefers.

### 2. Run

```bash
node <skill>/scripts/tsc-report.mjs run -- pnpm run typecheck
```

A non-zero exit code from tsc is the normal outcome when there are errors; the script itself exits 0 once the report is written. It exits 1 only when the command failed without producing any TypeScript diagnostic (command not found, script crashed): then read `tsc-output.txt` and tell the user what actually happened instead of reporting "0 errors". Any `WARNING:` line in the summary (for example a mismatch with tsc's own "Found N errors") must reach the user. A `NOTE:` about unresolved imports means the total is a floor (see the assessment section).

Large projects can take minutes; use a generous timeout rather than cutting the run short.

### 3. Report to the user

Use this structure:

1. **One line of totals**: errors, files, distinct codes, the command used and the report folder.
2. **Table by error code** (top 10): code, occurrences, files, what it means in plain words. Rewrite the sample message as a short explanation; the raw message is in the JSON.
3. **Table by file** (top 10): file, errors, main codes.
4. **One assessment paragraph** (below).
5. **Paths** of the three files written.

With zero errors, skip the tables: say the check passed, with the command and the report folder, in two lines.

### 4. The assessment paragraph

One paragraph, four to six sentences, that a tech lead could paste into a ticket. It answers: how healthy is the type check right now, what explains most of the errors, and what to do first. Read `references/error-codes.md` to interpret the dominant codes, then check the claim against the JSON (the messages, the files a code concentrates in) before you state a cause.

Look at the shape, not just the total:

- What share of the errors the top one to three codes account for, and whether they share one cause (a changed shared type, a missing install, a strictness flag that was just turned on, a tsconfig problem).
- Whether errors are concentrated in a few files or folders, or spread across the project.
- Global diagnostics (no file): the configuration does not parse; that comes first, everything else waits.
- Unresolved imports (TS2307, TS2792, TS7016; the summary prints a `NOTE:`): whatever comes from those modules is typed as `any`, so the errors behind them are not reported yet. Say plainly that the total is a floor and that more errors are expected once imports resolve. When the fix is a small config change (a `paths` alias, `moduleResolution`), you may confirm it by running the script against a temporary copy of the tsconfig outside the project (`--out` to a temporary folder), then delete it; report the hidden errors it reveals, and never leave the project's tsconfig changed.

Then recommend a concrete first action, ordered by leverage: the fix that clears the most errors per change goes first (install dependencies, fix the tsconfig, update the one shared type), and a burn-down strategy (per folder, CI gate on new errors) only when the errors are genuinely spread out. Name the files or the type involved. Do not promise a number of errors a fix will remove unless the JSON shows it (for example "the 38 TS2307 all point at `@/` imports").

Example (for a report with 112 errors):

> O typecheck está bloqueado por poucas causas: 71 dos 112 erros (63%) são TS2307 e TS2339, e todos os TS2307 apontam para imports `@/api/*`, o que indica um alias de `paths` ausente no `tsconfig.app.json` em vez de código quebrado. Os TS2339 se concentram em `src/stores/order.ts` e `src/pages/Checkout.tsx` e citam campos de `OrderDTO`, sugerindo que o tipo gerado da API mudou e os consumidores não acompanharam. O restante (TS7006, 23 ocorrências) é dívida de `noImplicitAny` espalhada por `src/legacy/`. Sugiro, nesta ordem: corrigir o alias `@/` no tsconfig, regenerar ou atualizar `OrderDTO` e rodar o relatório de novo antes de atacar os implícitos, que podem ser tratados por pasta.

Stop after the report. Do not start fixing errors unless the user asks; offer it in one line ("Quer que eu comece pelo alias do tsconfig?").

## Housekeeping

`tsc-reports/` holds snapshots, not source. If the project's `.gitignore` does not cover it, say so once and offer to add it; do not edit `.gitignore` on your own. To compare with an earlier run, the previous timestamp folders are next to the new one: when one exists, add a line with the delta of total errors.
