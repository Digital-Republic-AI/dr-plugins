# dr-plugins

English | [Português](README.pt-BR.md)

Digital Republic's marketplace of Claude Code plugins and skills. Each entry covers one recurring part of software work, such as specifying a change, documenting an architecture, running parallel workers, publishing a site or collecting decisions. They install separately, so you only add what you use.

> Last updated: 2026-11-12

## Installation

```text
/plugin marketplace add Digital-Republic-AI/dr-plugins
/plugin install <name>@dr-plugins
```

Restart Claude Code after installing a plugin. Skills distributed on their own (no plugin manifest) are namespaced by their catalog entry: `c4-codebase` is invoked as `/c4-codebase:c4-codebase`.

## Catalog

| Name | Type | Version | In one line |
|---|---|---|---|
| [spek](plugins/spek/) | Plugin | 0.6.0 | Spec-driven development that starts from the code you already have |
| [fleet](plugins/fleet/) | Plugin | 0.2.0 | A lead session that runs worker Claude Code teammates in split panes |
| [notes](plugins/notes/) | Plugin | 0.1.1 | Post-it notes from `/note <text>`, shown on a board in a side pane |
| [c4-codebase](skills/c4-codebase/) | Skill | 1.0.0 | Architecture documentation and a C4 model reverse-engineered from a repository |
| [tsc-report](skills/tsc-report/) | Skill | 1.0.0 | TypeScript type check with grouped reports and a recommended first action |
| [brainstorm-ideias](skills/brainstorm-ideias/) | Skill | 1.0.0 | Ideation sessions backed by 40+ documented methods |
| [cloudflare-static-publish](skills/cloudflare-static-publish/) | Skill | 1.0.0 | Static sites on Cloudflare with deploy, login protection and DNS |
| [open-questions](skills/open-questions/) | Skill | 1.0.0 | Open questions of the current work as a page that people answer one at a time |
| [pr-review-board](skills/pr-review-board/) | Skill | 1.0.0 | Open PRs grouped by review decision as a colored board, in the browser and in the terminal |

## Plugins

### spek

Spec-driven development built for existing codebases. `/spek:extract` first records how the current code behaves as a baseline. The change is then specified with explicit scope boundaries, clarified, planned, split into tasks, implemented and verified against both the spec and the baseline. New projects follow the same flow without the extract step, and small changes can use a condensed mode after you confirm it.

- **Helps with**: changes to code nobody fully remembers, where the risk is breaking behavior that was never written down. The baseline and the verify step make that risk visible before merge.
- **Start with**: `/spek:start`, which detects the project state and runs the right first command.
- **Requires**: `bash` and `jq`.

### fleet

Turns a Claude Code session into a lead that orchestrates worker teammates, each in its own split pane. Work comes from a Markdown task plan with dependencies and optional agent types. The lead dispatches the items that are ready, marks them as they start and finish, and shows a live status pane. The `task-plan` skill splits a goal into parallel items, and `orchestrate` runs and supervises the plan.

- **Helps with**: tasks that split into independent parts, such as several modules, several fixes or a migration in batches, where one session working in sequence is the bottleneck.
- **Start with**: `/fleet`.
- **Requires**: agent teams enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) and a team mode with panes (`tmux`, `iterm2` or `auto`).

### notes

Keeps quick notes as post-its. `/note Revisar o PR do checkout` adds a colored card to a board that opens in a pane beside the chat, with the note's number, time and project folder. Notes are saved across sessions. `/note lista` lists them in the chat, `/note rm 3` deletes note #3, and each card has its own delete button.

- **Helps with**: ideas, reminders and to-dos that come up mid-task and would otherwise get lost in the scrollback or sent to the model by mistake.
- **Start with**: `/note <text>`, or `/note` to open the board.
- **Requires**: nothing beyond Claude Code.

## Skills

### c4-codebase

Reverse-engineers a repository or monorepo into architecture documents and a C4 model in Structurizr DSL. Every element points to the evidence it came from in the code. Progress is saved in `.c4-codebase/`, so a large codebase can be mapped across several sessions.

- **Helps with**: onboarding, architecture reviews and integration mapping, when the existing diagrams are missing or out of date.
- **Requires**: Python 3.7+ and git. Validating and exporting the DSL needs Docker or the Structurizr CLI with Java 17+.

### tsc-report

Runs the project's TypeScript type check (its `typecheck` script, `tsc` or `tsc -b`) and saves the raw output plus two JSON reports, one grouped by error code and one by file, under `./tsc-reports/<timestamp>/`. The answer shows tables and one paragraph on the current state and the first thing to fix.

- **Helps with**: turning hundreds of type errors into a short list of causes, and comparing runs over time.
- **Requires**: Node.js 18+ and a TypeScript type checker.

### brainstorm-ideias

An ideation facilitator backed by a research base of over 40 methods, among them How Might We, SCAMPER, TRIZ, premortem, Jobs-to-be-Done and Blue Ocean. It runs a session on your problem with divergence and convergence kept apart, or explains a technique with a worked example. Cases and figures it cites come from the research base, not from memory.

- **Helps with**: getting past the first obvious answers, planning a team workshop, or stress-testing an idea before investing in it.
- **Start with**: ask for ideas or for a brainstorm. Claude uses the skill on its own when the request fits.

### cloudflare-static-publish

Publishes a static site, plain HTML or a build output such as Vite, Astro or a Next.js export, on Cloudflare Workers Static Assets or Pages. It generates `wrangler.jsonc`, a manual deploy script and an optional GitHub Actions workflow, can protect the site with Cloudflare Access One-time PIN, and sets up the custom domain DNS. Every Cloudflare change is shown as a plan first and applied only after you confirm.

- **Helps with**: internal docs, prototypes and landing pages that need a URL, optional e-mail-based access and repeatable deploys, without setting up the Cloudflare pieces by hand.
- **Requires**: Node.js 18+, a Cloudflare account, and `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment for the API steps.

### open-questions

Collects what is still undecided in the current work, such as gaps, assumptions to confirm, decisions and changes to approve. It publishes them as a claude.ai Artifact that shows one question at a time, with enough context to answer without the terminal. Each type of item gets fitting controls: options with their consequences, confirm or correct, approve or change, or free text. Answers are saved on the page, so Claude can read them back and continue, and each question can be assigned to another person, such as a product owner, who answers only their part.

- **Helps with**: planning and review moments where several decisions pile up. They get answered calmly and in one place, instead of in a long chat message.
- **Requires**: Claude Code signed in with `/login` on a claude.ai plan with Artifacts. Without the page's storage, answers can still be copied back by hand.

### pr-review-board

Lists the open pull requests of a repository grouped by review decision: not reviewed, changes requested, approved. It writes a self-contained HTML board with a stacked bar of the three groups, one column per group and a card per PR (author, age, CI status, reviewers and their verdicts, labels, draft and conflict flags), with the PRs that wait for you highlighted and filters by author and search. In a remote session without a browser the board is published as a claude.ai Artifact. The terminal gets the same groups as a Markdown summary, with shapes and block characters standing in for the colors, plus a short paragraph on what to look at first.

- **Helps with**: the daily "what is waiting on me, what can be merged, what is stuck" question, without opening each PR.
- **Start with**: `/pr-review-board:pr-review-board`, optionally with a repository (`owner/name`), `@me` for your own PRs or gh search terms such as `label:backend`. Claude also uses the skill on its own when you ask for the open PRs or what is awaiting your review.
- **Requires**: Node.js 18+ and the GitHub CLI (`gh`) signed in. Works offline from a saved `gh pr list --json` export.

## Contributing

How the repository is organized and how to release a new version is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Change History

- Created: 2026-08-30
- Updated: 2026-08-30 - Removed the spek research corpus from docs/
- Updated: 2026-08-30 - Removed docs/ (development trackers are not versioned)
- Updated: 2026-09-15 - spek updated to 0.6.0
- Updated: 2026-09-24 - Added the c4-codebase skill 1.0.0
- Updated: 2026-10-20 - Added the fleet plugin 0.1.0
- Updated: 2026-11-01 - fleet updated to 0.2.0: task plans in Markdown, no WiseWork or DR dependency
- Updated: 2026-11-05 - Added the tsc-report skill 1.0.0
- Updated: 2026-11-04 - Added the brainstorm-ideias skill 1.0.0
- Updated: 2026-11-06 - Added the cloudflare-static-publish skill 1.0.0
- Updated: 2026-11-08 - Added the open-questions skill 1.0.0
- Updated: 2026-11-08 - Rewrote the README around what each plugin and skill does; moved layout and release steps to CONTRIBUTING.md
- Updated: 2026-11-08 - Added the Portuguese version README.pt-BR.md and language links
- Updated: 2026-11-12 - Added the pr-review-board skill 1.0.0
- Updated: 2026-11-12 - Added the notes plugin 0.1.0
