---
name: pr-review-board
description: Lists the open pull requests of a GitHub repository grouped by review decision (not reviewed, changes requested, approved) as a colored board, with a stacked bar of the three groups, one column per group, a card per PR (author, age, CI status, reviewers and their verdicts, labels, draft and conflict flags) and the PRs that wait for the current user highlighted. Writes a self-contained HTML board that opens in the browser and prints a Markdown summary with the same groups for the terminal. Use it whenever the user wants to see the open PRs, who reviewed what, what is waiting for review or for them, what is approved and ready to merge, or asks for a PR board, dashboard, overview or status, even without saying "review" or "board", e.g. "mostra as PRs abertas", "como estão as PRs", "o que está esperando minha revisão", "quais PRs já foram aprovadas", "board de PRs", "PRs agrupadas por status", "lista as PRs de um jeito mais visual". Not for reviewing, merging or commenting on a PR; it only shows the state.
license: MIT
compatibility: Requires Node.js 18+ and the GitHub CLI (gh) signed in to github.com for live data. Works offline from a saved `gh pr list --json` export.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/*)
metadata:
  version: "1.0.0"
---

# PR review board

A list of open PRs in the order GitHub gives them hides the question people actually have: what is waiting on nobody, what is blocked on the author, what is done and only needs a merge. This skill answers it with a board: three groups by review decision, the same color and shape for each group everywhere, and the PRs that wait on the current user pulled to the top.

Two outputs, because the terminal has no color: the bundled script writes an HTML board (colors, columns, filters) and prints a Markdown summary (block characters and the shapes ○ ◐ ● carry the grouping). Your part is choosing the scope, relaying the summary without flattening it, and reading the board for the user in a few sentences.

Talk to the user in their language (Portuguese with full diacritics when they write in Portuguese) and pass the matching `--lang`. No emojis; the script's shapes and marks are plain Unicode.

## Script

`scripts/pr-board.mjs` (Node 18+, no dependencies). `<skill>` below is this skill's directory (`${CLAUDE_SKILL_DIR}`). It calls `gh` itself; you never need to run `gh pr list` by hand.

```bash
node <skill>/scripts/pr-board.mjs [--repo OWNER/NAME]... [--lang pt|en] [--open] [--author @me] [--no-drafts] [--search QUERY] [--input FILE] [--viewer LOGIN] [--out DIR] [--json]
```

| Option | Use it when |
|--------|-------------|
| `--repo OWNER/NAME` | The user names a repository, or several (repeat the flag; the board then prefixes each PR with its repo). Without it, the repository of the current directory. |
| `--lang pt` / `--lang en` | Match the user's language. It sets the summary and the page. |
| `--open` | The user is on their own machine: opens `board.html` in the default browser. Skip it in a remote or headless session (the script only warns, but there is nothing to open there). |
| `--author @me` | The user asks for their own PRs only. Any login works. |
| `--search QUERY` | The user narrows by label, base branch or text: it is passed to `gh pr list --search` (for example `label:backend base:main`). |
| `--no-drafts` | The user does not want drafts. By default drafts are shown, dimmed and last in their column. |
| `--stale-days N` | The team's idea of "stale" is not 7 days without activity. |
| `--input FILE` | There is no `gh` access and the user hands you a saved `gh pr list --json ...` export. Pair with `--repo` for the label and `--viewer LOGIN` for the highlights, since offline the script cannot ask gh who the user is. |
| `--limit N` | A repository has more than 100 open PRs (the summary warns when the limit is hit). |
| `--out DIR` | The user wants the files somewhere specific. Default: `<tmp>/pr-review-board/<repo>/`. |
| `--json` | You need the data instead of the summary (for a follow-up question such as "which of these touch the checkout?"). The same data is always written to `board.json`. |

The script exits 2 for a usage problem, 3 when gh is missing or not signed in (the message says which; relay it and stop, do not try other ways of reaching GitHub), and 0 otherwise.

## How the groups are decided

The script applies the same rule GitHub shows on the PR page, from `reviewDecision` and the latest review of each reviewer (the author's own reviews and dismissed ones do not count):

| Group | Rule |
|-------|------|
| Changes requested (◐, red) | Any reviewer's latest review requests changes. It wins over approvals from others, because the author has work to do. |
| Approved (●, green) | GitHub's decision is approved; or, on a branch without a review rule, at least one approval and no request for changes. |
| Not reviewed (○, amber) | Everything else: no reviews, only comments, or approvals that do not satisfy the branch's rule yet. |

Badges tell the cases apart inside the "not reviewed" column: `commented` (someone looked without deciding), `partially approved` (approved by someone, but the branch still requires review), `draft`, `awaiting you` (the user is a requested reviewer), `stale` (no activity for the stale window), `conflicts`. CI comes from the check rollup: passing, failing, running or none. `references/review-states.md` has the full mapping and the gh fields behind it, for when a user asks why a PR landed where it did.

## Workflow

### 1. Scope

Default to the repository of the current directory. When the user names a repository or several, pass each with `--repo`. When they ask about "my PRs", add `--author @me`; when they ask what waits for them, run the full board (the highlights and the "awaiting your review" count answer that) rather than filtering, so they also see the context around it.

### 2. Run

```bash
node <skill>/scripts/pr-board.mjs --lang pt --open
```

Offline, with an export the user gave you:

```bash
node <skill>/scripts/pr-board.mjs --input prs.json --repo acme/shop-api --viewer marina-dev --lang pt
```

### 3. Reply

Relay the summary the script printed, in this order and without reformatting it into prose:

1. The title line with the total.
2. The code block with the stacked bar and the legend line (the block characters only line up in a code block; keep it as one).
3. The stats line (awaiting you, yours, approved and green, CI failing, stale, drafts).
4. The three group tables, in the script's order: not reviewed, changes requested, approved. Keep the shapes in the headings and the marks in the cells; they are the only grouping cue a terminal has. Do not drop a column to save width. The age column shows days since the PR was opened; a stale PR also shows how many days it has been idle, and the two are different numbers (a PR can be 20 days old and 10 days idle).

Then add one short paragraph (two to four sentences) that reads the board for the user, in this order of usefulness: what waits for them by name, what is approved with green checks and can be merged, what is stuck (stale, conflicting, approved but with failing checks). Name the PRs by number and title. Do not invent a reason a PR is stuck beyond what the badges show.

Close with the path of `board.html` (and that it was opened, when `--open` was used). When the user is in a remote session and the Artifact tool is available, offer in one line to publish the page as an Artifact so they can open it from the app; publish it only if they say yes.

Example of the paragraph, for a board with 10 PRs:

> Duas PRs esperam a sua revisão: #398 (rate limiter do carrinho, já com uma aprovação do bruno-lima) e #412 (idempotência no checkout, aberta ontem). #410 e #407 estão aprovadas com checks verdes e podem ser mescladas. #401 pede atenção: tem modificações solicitadas, conflito com a main e está parada há 10 dias; #405 está aprovada, mas o check de teste falhou.

With no open PRs, the script prints the title and one line; relay those two lines and stop.

### 4. After the board

Stop there. Do not review, comment on or merge anything unless the user asks next; offer the obvious follow-up in one line ("Quer que eu abra a #398 para revisar?"). For a follow-up question about the same PRs, read `board.json` instead of running gh again, unless the user asks for fresh data.

## Housekeeping

`board.html` and `board.json` go to the temp directory by default, so nothing lands in the repository. With `--out` inside the project, mention once that the folder is a snapshot and should be ignored by git, and do not edit `.gitignore` on your own.
