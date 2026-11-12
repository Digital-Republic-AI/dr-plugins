// Normalizes the raw `gh pr list --json` records and groups them by review
// decision. Pure functions, no I/O, so the same code runs on live data and on
// a saved fixture.

export const GROUPS = ['unreviewed', 'changes_requested', 'approved'];

const CHECK_FAILED = new Set(['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);
const CHECK_PASSED = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);
const DAY_MS = 24 * 60 * 60 * 1000;

export function ciStatus(rollup) {
  const result = { state: 'none', total: 0, passed: 0, failed: 0, pending: 0 };
  if (!Array.isArray(rollup) || rollup.length === 0) return result;
  for (const check of rollup) {
    const value =
      check.__typename === 'StatusContext'
        ? check.state
        : check.status === 'COMPLETED'
          ? check.conclusion
          : 'PENDING';
    result.total += 1;
    if (CHECK_FAILED.has(value)) result.failed += 1;
    else if (CHECK_PASSED.has(value)) result.passed += 1;
    else result.pending += 1;
  }
  result.state = result.failed ? 'failing' : result.pending ? 'pending' : 'passing';
  return result;
}

function daysBetween(from, to) {
  const start = Date.parse(from);
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((to - start) / DAY_MS));
}

function reviewerName(request) {
  if (!request) return null;
  if (request.__typename === 'Team' || (request.slug && !request.login)) {
    return { login: request.slug || request.name, team: true };
  }
  return { login: request.login || request.name, team: false };
}

export function normalizePr(raw, { viewer = null, repo = null, now = Date.now(), staleDays = 7 } = {}) {
  const author = raw.author?.login || 'unknown';
  const reviews = (raw.latestReviews || [])
    .filter((review) => review?.author?.login && review.author.login !== author)
    .filter((review) => review.state && review.state !== 'DISMISSED' && review.state !== 'PENDING')
    .map((review) => ({ login: review.author.login, state: review.state, submittedAt: review.submittedAt || null }));
  const requested = (raw.reviewRequests || []).map(reviewerName).filter((r) => r && r.login);
  const decisionRaw = raw.reviewDecision || '';
  const approvals = reviews.filter((r) => r.state === 'APPROVED').length;
  const changesRequested = decisionRaw === 'CHANGES_REQUESTED' || reviews.some((r) => r.state === 'CHANGES_REQUESTED');

  let group;
  if (changesRequested) group = 'changes_requested';
  else if (decisionRaw === 'APPROVED') group = 'approved';
  else if (decisionRaw === 'REVIEW_REQUIRED') group = 'unreviewed';
  else if (approvals > 0) group = 'approved'; // no review rule on the branch: one approval counts
  else group = 'unreviewed';

  const daysOpen = daysBetween(raw.createdAt, now);
  const daysIdle = daysBetween(raw.updatedAt || raw.createdAt, now);
  const awaitingYou = Boolean(viewer) && requested.some((r) => !r.team && r.login === viewer);
  const badges = [];
  if (raw.isDraft) badges.push('draft');
  if (awaitingYou) badges.push('awaiting_you');
  if (viewer && author === viewer) badges.push('mine');
  if (group === 'unreviewed' && approvals > 0) badges.push('partial');
  if (group === 'unreviewed' && approvals === 0 && reviews.some((r) => r.state === 'COMMENTED')) badges.push('commented');
  if (daysIdle !== null && daysIdle >= staleDays) badges.push('stale');
  if (raw.mergeable === 'CONFLICTING') badges.push('conflict');

  return {
    repo: repo || raw.headRepository?.nameWithOwner || null,
    number: raw.number,
    title: raw.title || '',
    url: raw.url || '',
    author,
    authorIsBot: Boolean(raw.author?.is_bot),
    isDraft: Boolean(raw.isDraft),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    daysOpen,
    daysIdle,
    headRefName: raw.headRefName || '',
    baseRefName: raw.baseRefName || '',
    additions: raw.additions ?? 0,
    deletions: raw.deletions ?? 0,
    labels: (raw.labels || []).map((label) => ({ name: label.name, color: label.color || '' })),
    reviewDecision: decisionRaw || null,
    group,
    approvals,
    reviews,
    requested,
    awaitingYou,
    ci: ciStatus(raw.statusCheckRollup),
    mergeable: raw.mergeable || null,
    badges,
  };
}

function rank(pr) {
  // Drafts sink to the bottom; what waits for the viewer floats to the top;
  // otherwise the PR that has been idle the longest comes first, because it
  // is the one most likely to be forgotten.
  if (pr.isDraft) return 2;
  if (pr.awaitingYou) return 0;
  return 1;
}

export function sortPrs(prs) {
  return [...prs].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    const idle = (b.daysIdle ?? 0) - (a.daysIdle ?? 0);
    if (idle !== 0) return idle;
    return a.number - b.number;
  });
}

export function buildBoard(rawPrs, options = {}) {
  const { viewer = null, repos = [], now = Date.now(), staleDays = 7, includeDrafts = true } = options;
  const prs = rawPrs
    .map((raw) => normalizePr(raw, { viewer, repo: raw.__repo || repos[0] || null, now, staleDays }))
    .filter((pr) => includeDrafts || !pr.isDraft);
  const groups = Object.fromEntries(GROUPS.map((g) => [g, sortPrs(prs.filter((pr) => pr.group === g))]));
  const totals = {
    open: prs.length,
    unreviewed: groups.unreviewed.length,
    changes_requested: groups.changes_requested.length,
    approved: groups.approved.length,
    drafts: prs.filter((pr) => pr.isDraft).length,
    awaitingYou: prs.filter((pr) => pr.awaitingYou).length,
    mine: prs.filter((pr) => pr.badges.includes('mine')).length,
    ciFailing: prs.filter((pr) => pr.ci.state === 'failing').length,
    stale: prs.filter((pr) => pr.badges.includes('stale')).length,
    readyToMerge: groups.approved.filter((pr) => !pr.isDraft && pr.ci.state !== 'failing' && pr.mergeable !== 'CONFLICTING').length,
  };
  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    viewer,
    repos,
    staleDays,
    includeDrafts,
    totals,
    groups,
  };
}
