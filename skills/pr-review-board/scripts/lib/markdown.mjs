// The Markdown summary printed to stdout. It is what the assistant relays in
// the terminal, where there is no color, so shapes and block characters carry
// the grouping instead.
import { GROUPS } from './classify.mjs';
import { BAR_CHARS, CI_MARKS, SHAPES, strings } from './i18n.mjs';

const BAR_WIDTH = 30;

function cell(text) {
  return String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function stackedBar(totals, width = BAR_WIDTH) {
  if (!totals.open) return '';
  const shares = GROUPS.map((g) => (totals[g] / totals.open) * width);
  const widths = shares.map(Math.floor);
  let remainder = width - widths.reduce((a, b) => a + b, 0);
  // Give the leftover cells to the groups with the largest fractional part,
  // and make sure a non-empty group never renders as zero cells.
  const order = shares.map((s, i) => [s - widths[i], i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (remainder <= 0) break;
    widths[i] += 1;
    remainder -= 1;
  }
  GROUPS.forEach((g, i) => {
    if (totals[g] > 0 && widths[i] === 0) {
      const donor = widths.indexOf(Math.max(...widths));
      widths[donor] -= 1;
      widths[i] = 1;
    }
  });
  return GROUPS.map((g, i) => BAR_CHARS[g].repeat(widths[i])).join('');
}

function ageCell(pr, t) {
  const age = pr.daysOpen === null ? '?' : t.days(pr.daysOpen);
  return pr.badges.includes('stale') ? `${age} · ${t.idleShort} ${t.days(pr.daysIdle)}` : age;
}

function reviewsCell(pr, t) {
  const parts = pr.reviews.map((r) => `${r.login} ${SHAPES[r.state === 'APPROVED' ? 'approved' : r.state === 'CHANGES_REQUESTED' ? 'changes_requested' : 'unreviewed']}`);
  const pending = pr.requested.filter((r) => !pr.reviews.some((rev) => rev.login === r.login)).map((r) => `${r.team ? '@' : ''}${r.login} ?`);
  const all = [...parts, ...pending];
  return all.length ? all.join(', ') : t.noReviews;
}

function titleCell(pr, t) {
  const marks = [];
  if (pr.isDraft) marks.push(t.badges.draft);
  if (pr.awaitingYou) marks.push(t.badges.awaiting_you);
  if (pr.badges.includes('partial')) marks.push(t.badges.partial);
  if (pr.badges.includes('commented')) marks.push(t.badges.commented);
  if (pr.badges.includes('conflict')) marks.push(t.badges.conflict);
  const suffix = marks.length ? ` [${marks.join(', ')}]` : '';
  return `[${cell(pr.title)}](${pr.url})${suffix}`;
}

export function renderMarkdown(board, { lang = 'en', paths = {} } = {}) {
  const t = strings(lang);
  const { totals } = board;
  const repoLabel = board.repos.length ? board.repos.join(', ') : '?';
  const lines = [];
  lines.push(`## ${t.title} · ${repoLabel} · ${totals.open}`);
  lines.push('');
  if (!totals.open) {
    lines.push(t.noPrs);
    return lines.join('\n');
  }
  const legend = GROUPS.map((g) => `${SHAPES[g]} ${totals[g]} ${t.groupsShort[g]}`).join(' · ');
  lines.push('```');
  lines.push(stackedBar(totals));
  lines.push(legend);
  lines.push('```');
  const stats = [];
  if (board.viewer) stats.push(`${t.stats.awaitingYou}: ${totals.awaitingYou}`);
  if (board.viewer) stats.push(`${t.stats.mine}: ${totals.mine}`);
  stats.push(`${t.stats.readyToMerge}: ${totals.readyToMerge}`);
  stats.push(`${t.stats.ciFailing}: ${totals.ciFailing}`);
  stats.push(`${t.stats.stale(board.staleDays)}: ${totals.stale}`);
  stats.push(`${t.stats.drafts}: ${totals.drafts}`);
  lines.push(stats.join(' · '));
  lines.push('');
  for (const g of GROUPS) {
    const prs = board.groups[g];
    lines.push(`### ${SHAPES[g]} ${t.groups[g]} (${prs.length})`);
    lines.push('');
    if (!prs.length) {
      lines.push(`_${t.emptyColumn}_`);
      lines.push('');
      continue;
    }
    const c = t.columns;
    lines.push(`| ${c.pr} | ${c.title} | ${c.author} | ${c.age} | ${c.ci} | ${c.reviews} |`);
    lines.push('|---|---|---|---|---|---|');
    for (const pr of prs) {
      const num = board.repos.length > 1 && pr.repo ? `${pr.repo}#${pr.number}` : `#${pr.number}`;
      lines.push(`| ${num} | ${titleCell(pr, t)} | ${pr.author} | ${ageCell(pr, t)} | ${CI_MARKS[pr.ci.state]} | ${reviewsCell(pr, t)} |`);
    }
    lines.push('');
  }
  if (paths.html || paths.json) {
    if (paths.html) lines.push(`${t.files.html}: ${paths.html}`);
    if (paths.json) lines.push(`${t.files.json}: ${paths.json}`);
  }
  return lines.join('\n');
}
