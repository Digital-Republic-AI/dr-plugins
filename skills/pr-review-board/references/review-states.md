# Review states and the gh fields behind them

Read this when a user asks why a PR landed in a given column, or when a repository's branch rules make the grouping look odd.

## Fields the script reads

`gh pr list --state open --json number,title,url,author,isDraft,createdAt,updatedAt,reviewDecision,latestReviews,reviewRequests,labels,headRefName,baseRefName,additions,deletions,statusCheckRollup,mergeable`

| Field | What it holds | Used for |
|-------|---------------|----------|
| `reviewDecision` | GitHub's own verdict: `APPROVED`, `CHANGES_REQUESTED`, `REVIEW_REQUIRED`, or empty when the base branch has no rule that requires reviews | The group, when present |
| `latestReviews` | The most recent review of each reviewer: `APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`, `DISMISSED`, `PENDING` | The group when `reviewDecision` is empty; the reviewer chips; the `commented` and `partially approved` badges |
| `reviewRequests` | Users and teams whose review is currently requested. GitHub removes a user from here once they submit a review, and puts them back on a re-request | The `awaiting you` badge and the dashed "?" chips |
| `isDraft` | Draft PR | The `draft` badge; drafts sort last in their column |
| `mergeable` | `MERGEABLE`, `CONFLICTING` or `UNKNOWN` | The `conflicts` badge; `UNKNOWN` means GitHub has not computed it yet and is shown as nothing |
| `statusCheckRollup` | One entry per check run or commit status | The CI dot: failing wins over running, running wins over passing; an empty list is "no checks" |
| `createdAt`, `updatedAt` | Timestamps | Age in days and the `stale` badge (no activity for `--stale-days`, default 7) |
| `labels` | Name and color | Label chips in the label's own color |
| `additions`, `deletions` | Diff size | The green/red size bar |

## The grouping rule

1. Drop the author's own reviews, and any `DISMISSED` or `PENDING` review. A dismissed review no longer blocks; a pending one has not been submitted.
2. If `reviewDecision` is `CHANGES_REQUESTED`, or any remaining latest review is `CHANGES_REQUESTED`: **changes requested**. One blocking review outweighs approvals from others, which is also what GitHub's merge box does.
3. Else, if `reviewDecision` is `APPROVED`: **approved**.
4. Else, if `reviewDecision` is `REVIEW_REQUIRED`: **not reviewed**. Approvals that exist get the `partially approved` badge; the branch rule wants more (another approval, a code owner, a re-review after new commits).
5. Else (no branch rule, `reviewDecision` empty): **approved** if at least one approval remains, otherwise **not reviewed**.

A `COMMENTED` review never moves a PR out of "not reviewed"; it only adds the `commented` badge, so the user sees that someone looked without deciding.

## CI states

| Entry type | Field | Failing | Passing | Running |
|------------|-------|---------|---------|---------|
| `CheckRun` with `status: COMPLETED` | `conclusion` | `FAILURE`, `ERROR`, `TIMED_OUT`, `CANCELLED`, `ACTION_REQUIRED`, `STARTUP_FAILURE` | `SUCCESS`, `NEUTRAL`, `SKIPPED` | |
| `CheckRun` not completed | `status` | | | `QUEUED`, `IN_PROGRESS`, `PENDING`, `WAITING`, `REQUESTED` |
| `StatusContext` | `state` | `FAILURE`, `ERROR` | `SUCCESS` | `PENDING`, `EXPECTED` |

"Approved and green" in the stats counts approved, non-draft PRs whose checks are not failing and that have no conflicts. It is a hint, not a guarantee: a required check that has not run yet still blocks the merge on GitHub.

## Things the data cannot tell

- How many approvals the branch rule requires, or whether a code owner is missing. `REVIEW_REQUIRED` with approvals is all the API says.
- Whether the user belongs to a team that was requested. Team requests show as `@team-slug` chips, and they do not count as "awaiting you".
- Reviews from before the latest push are still "latest reviews". If the repository dismisses stale approvals, GitHub marks them `DISMISSED` and the script ignores them; otherwise an old approval still counts.
