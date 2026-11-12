// Renders the board as one self-contained HTML page: a to-scale bar of the
// three review decisions, a short "needs a look" list, a sticky filter rail and
// one tinted lane per decision. Cards stay neutral and carry the verdict as a
// shape, so color is never the only cue. External assets: the GitHub avatars
// and the Google Fonts stylesheet, both with fallbacks.
import { GROUPS } from './classify.mjs';
import { strings } from './i18n.mjs';

const FONTS_URL = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Schibsted+Grotesk:wght@400;500;600;700;800&display=swap';
const AVATAR_SIZE = 40;
const HEX_COLOR = /^[0-9a-f]{6}$/i;

const FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#6d4fd6" stroke-width="2"/><path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="#6d4fd6"/></svg>')}`;

const ICONS = {
  passing: '<path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  failing: '<path d="M4.5 4.5l7 7m0-7l-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  pending: '<path d="M8 2.5a5.5 5.5 0 1 1-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  none: '<path d="M4.5 8h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  clock: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.8V8l2.2 1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  search: '<circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 10.5l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  chevron: '<path d="M4.5 6.5l3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  check: '<path d="M3.8 8.4l2.7 2.7 5.7-6.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function icon(name, size = 14) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true">${ICONS[name]}</svg>`;
}

// Inline SVG instead of the ○ ◐ ● glyphs: fonts render the half circle at
// very different sizes, and the shapes must read the same everywhere. The
// dashed ring marks a reviewer who was asked and has not answered yet.
export function shapeSvg(group, size = 14) {
  const fill = { unreviewed: '', changes_requested: '<path d="M8 1.5a6.5 6.5 0 0 0 0 13z" fill="currentColor"/>', approved: '<circle cx="8" cy="8" r="6.5" fill="currentColor"/>' }[group] || '';
  const dash = group === 'requested' ? ' stroke-dasharray="2.6 2.4"' : '';
  return `<svg class="shape" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="2"${dash}/>${fill}</svg>`;
}

function reviewGroup(state) {
  if (state === 'APPROVED') return 'approved';
  if (state === 'CHANGES_REQUESTED') return 'changes_requested';
  return 'unreviewed';
}

function formatDate(iso, lang) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function repoHeading(repo) {
  const slash = repo.lastIndexOf('/');
  if (slash < 0) return esc(repo);
  return `<span class="owner">${esc(repo.slice(0, slash + 1))}</span>${esc(repo.slice(slash + 1))}`;
}

function flagsOf(pr, t) {
  return pr.badges
    .map((b) => {
      const text = b === 'stale' && pr.daysIdle !== null ? `${t.badges.stale} ${t.days(pr.daysIdle)}` : t.badges[b] || b;
      const lead = b === 'stale' ? icon('clock', 12) : '';
      return `<li class="flag flag-${b}" title="${esc(t.badgeTitles[b] || '')}">${lead}${esc(text)}</li>`;
    })
    .join('');
}

function reviewersOf(pr, t) {
  const done = pr.reviews.map((r) => {
    const g = reviewGroup(r.state);
    const verdict = t.reviewStates[r.state] || r.state.toLowerCase();
    return `<li class="rev rev-${g}" title="${esc(r.login)} ${esc(verdict)}">${shapeSvg(g, 12)}${esc(r.login)}<span class="sr-only"> ${esc(verdict)}</span></li>`;
  });
  const waiting = pr.requested
    .filter((r) => !pr.reviews.some((rev) => rev.login === r.login))
    .map((r) => `<li class="rev rev-requested" title="${esc(r.login)} · ${esc(t.requested)}">${shapeSvg('requested', 12)}${r.team ? '@' : ''}${esc(r.login)}<span class="sr-only"> ${esc(t.requested)}</span></li>`);
  const all = [...done, ...waiting];
  return all.length ? `<ul class="reviewers">${all.join('')}</ul>` : `<p class="rev-none">${esc(t.noReviews)}</p>`;
}

function labelsOf(pr) {
  if (!pr.labels.length) return '';
  const items = pr.labels
    .map((l) => {
      const dot = HEX_COLOR.test(l.color || '') ? ` style="--label:#${l.color}"` : '';
      return `<li class="label"><i${dot}></i>${esc(l.name)}</li>`;
    })
    .join('');
  return `<ul class="labels">${items}</ul>`;
}

function diffOf(pr) {
  const total = pr.additions + pr.deletions;
  const addShare = total ? Math.round((pr.additions / total) * 100) : 0;
  const bar = total ? `<span class="diffbar"><i style="width:${addShare}%"></i></span>` : '<span class="diffbar is-empty"></span>';
  return `<span class="diff" title="+${pr.additions} / −${pr.deletions}"><span class="add">+${pr.additions}</span><span class="del">−${pr.deletions}</span>${bar}</span>`;
}

function ciOf(pr, t) {
  const { state, total, passed } = pr.ci;
  const full = `${t.ci[state]}${total ? ` (${passed}/${total})` : ''}`;
  const text = total ? `${passed}/${total}` : t.ci[state];
  return `<span class="ci ci-${state}" title="${esc(full)}">${icon(state, 13)}<span aria-hidden="true">${esc(text)}</span><span class="sr-only">${esc(full)}</span></span>`;
}

function card(pr, t, multiRepo) {
  const ref = multiRepo && pr.repo ? `${esc(pr.repo)}#${pr.number}` : `#${pr.number}`;
  const search = [pr.title, pr.author, pr.headRefName, pr.baseRefName, ...pr.labels.map((l) => l.name), ...pr.reviews.map((r) => r.login), String(pr.number)]
    .join(' ')
    .toLowerCase();
  const ageTitle = `${t.opened} ${pr.daysOpen ?? '?'}d · ${t.idle} ${pr.daysIdle ?? '?'}d`;
  const initial = pr.author.replace(/[^a-z0-9]/gi, '').charAt(0).toUpperCase() || '?';
  const flags = flagsOf(pr, t);
  const classes = ['card', pr.isDraft ? 'is-draft' : '', pr.awaitingYou ? 'is-awaiting' : ''].filter(Boolean).join(' ');
  return `
        <article class="${classes}" data-group="${pr.group}" data-author="${esc(pr.author)}" data-draft="${pr.isDraft ? 1 : 0}" data-awaiting="${pr.awaitingYou ? 1 : 0}" data-mine="${pr.badges.includes('mine') ? 1 : 0}" data-search="${esc(search)}">
          <div class="card-head">
            ${shapeSvg(pr.group, 12)}
            <a class="num" href="${esc(pr.url)}" target="_blank" rel="noopener">${ref}</a>
            ${ciOf(pr, t)}
            <span class="age" title="${esc(ageTitle)}">${pr.daysOpen ?? '?'}d</span>
          </div>
          <h3 class="card-title"><a href="${esc(pr.url)}" target="_blank" rel="noopener">${esc(pr.title)}</a></h3>
          <div class="byline">
            <span class="avatar" data-initial="${esc(initial)}"><img src="https://avatars.githubusercontent.com/${esc(pr.author)}?s=${AVATAR_SIZE}" alt="" loading="lazy" onerror="this.remove()"></span>
            <span class="author">${esc(pr.author)}</span>
            <span class="branch" title="${esc(pr.headRefName)} → ${esc(pr.baseRefName)}">${esc(pr.headRefName)} → ${esc(pr.baseRefName)}</span>
          </div>
          ${flags ? `<ul class="flags">${flags}</ul>` : ''}
          <div class="card-foot">
            ${reviewersOf(pr, t)}
            ${diffOf(pr)}
          </div>
          ${labelsOf(pr)}
        </article>`;
}

function lane(group, prs, t, multiRepo) {
  return `
      <section class="lane lane-${group}" aria-labelledby="lane-${group}">
        <header class="lane-head">
          ${shapeSvg(group, 18)}
          <h2 id="lane-${group}">${esc(t.groups[group])}</h2>
          <span class="lane-count" data-count="${group}">${prs.length}</span>
          <p class="lane-hint">${esc(t.groupHints[group])}</p>
        </header>
        <div class="cards">${prs.map((pr) => card(pr, t, multiRepo)).join('')}
          <p class="empty" data-empty="${group}"${prs.length ? ' hidden' : ''}>${esc(t.emptyColumn)}</p>
        </div>
      </section>`;
}

function attentionList(board, t) {
  const { totals } = board;
  const rows = [
    board.viewer ? ['awaiting', t.stats.awaitingYou, totals.awaitingYou] : null,
    ['ready', t.stats.readyToMerge, totals.readyToMerge],
    ['failing', t.stats.ciFailing, totals.ciFailing],
    ['stale', t.stats.stale(board.staleDays), totals.stale],
    ['draft', t.stats.drafts, totals.drafts],
  ].filter(Boolean);
  return rows
    .map(([key, label, value]) => `<div class="att att-${key}${value ? '' : ' is-zero'}"><dt>${esc(label)}</dt><dd>${value}</dd></div>`)
    .join('');
}

function toolbar(board, t, authors) {
  const toggle = (id, label, checked) => `
      <label class="toggle"><input type="checkbox" id="${id}"${checked ? ' checked' : ''}><span class="tick">${icon('check', 12)}</span>${esc(label)}</label>`;
  return `
    <div class="toolbar" role="search">
      <label class="search">${icon('search', 16)}<span class="sr-only">${esc(t.filters.search)}</span><input type="search" id="q" placeholder="${esc(t.filters.search)}" autocomplete="off"></label>
      <label class="select"><span class="sr-only">${esc(t.columns.author)}</span><select id="author"><option value="">${esc(t.filters.allAuthors)}</option>${authors.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}</select>${icon('chevron', 16)}</label>
      ${board.viewer ? toggle('awaiting', t.filters.awaitingYou, false) + toggle('mine', t.filters.mine, false) : ''}
      ${toggle('drafts', t.filters.drafts, true)}
      <p class="showing">${t.showing(`<b data-visible>${board.totals.open}</b>`, `<b>${board.totals.open}</b>`)}</p>
    </div>`;
}

const STYLES = `
:root {
  /* Layout: masthead, then a to-scale split bar beside a short "needs a look" list, a sticky filter rail, and three lanes tinted by decision; cards stay neutral and carry the verdict as a shape. */
  --bg: oklch(97.6% 0.004 285);
  --surface: oklch(99.4% 0.002 285);
  --sunken: oklch(94.6% 0.007 285);
  --line: oklch(90% 0.008 285);
  --line-strong: oklch(82% 0.012 285);
  --fg: oklch(25% 0.02 285);
  --fg-2: oklch(47% 0.02 285);
  --accent: oklch(52% 0.19 288);
  --accent-tint: oklch(94.5% 0.03 288);
  --on-accent: oklch(98.5% 0.006 288);
  --unreviewed: oklch(66% 0.14 70);
  --unreviewed-ink: oklch(49% 0.11 62);
  --unreviewed-tint: oklch(95.5% 0.045 85);
  --changes_requested: oklch(60% 0.2 25);
  --changes_requested-ink: oklch(49% 0.18 25);
  --changes_requested-tint: oklch(95.5% 0.025 20);
  --approved: oklch(61% 0.15 150);
  --approved-ink: oklch(45% 0.12 150);
  --approved-tint: oklch(95.5% 0.04 150);
  --shadow: 0 1px 2px oklch(25% 0.02 285 / 0.06), 0 6px 16px oklch(25% 0.02 285 / 0.06);

  --font-display: "Schibsted Grotesk", "Helvetica Neue", Arial, system-ui, sans-serif;
  --font-body: "Schibsted Grotesk", "Helvetica Neue", Arial, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --fs-1: 0.75rem;
  --fs-2: 0.9375rem;
  --fs-3: 1.172rem;
  --fs-4: 1.465rem;
  --fs-5: 1.831rem;
  --fs-6: 2.289rem;
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px;
  --radius-s: 6px; --radius-m: 10px; --radius-l: 16px;
  --control: 44px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: oklch(17.5% 0.012 285);
    --surface: oklch(21.5% 0.014 285);
    --sunken: oklch(15.5% 0.01 285);
    --line: oklch(30% 0.016 285);
    --line-strong: oklch(39% 0.02 285);
    --fg: oklch(94% 0.008 285);
    --fg-2: oklch(73% 0.016 285);
    --accent: oklch(76% 0.13 288);
    --accent-tint: oklch(29% 0.07 288);
    --on-accent: oklch(18% 0.03 288);
    --unreviewed: oklch(80% 0.14 80);
    --unreviewed-ink: oklch(85% 0.12 85);
    --unreviewed-tint: oklch(28% 0.05 75);
    --changes_requested: oklch(70% 0.17 25);
    --changes_requested-ink: oklch(79% 0.12 25);
    --changes_requested-tint: oklch(28% 0.06 25);
    --approved: oklch(74% 0.15 150);
    --approved-ink: oklch(82% 0.12 150);
    --approved-tint: oklch(27% 0.05 150);
    --shadow: 0 1px 2px oklch(8% 0.01 285 / 0.5), 0 6px 16px oklch(8% 0.01 285 / 0.35);
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: oklch(17.5% 0.012 285);
  --surface: oklch(21.5% 0.014 285);
  --sunken: oklch(15.5% 0.01 285);
  --line: oklch(30% 0.016 285);
  --line-strong: oklch(39% 0.02 285);
  --fg: oklch(94% 0.008 285);
  --fg-2: oklch(73% 0.016 285);
  --accent: oklch(76% 0.13 288);
  --accent-tint: oklch(29% 0.07 288);
  --on-accent: oklch(18% 0.03 288);
  --unreviewed: oklch(80% 0.14 80);
  --unreviewed-ink: oklch(85% 0.12 85);
  --unreviewed-tint: oklch(28% 0.05 75);
  --changes_requested: oklch(70% 0.17 25);
  --changes_requested-ink: oklch(79% 0.12 25);
  --changes_requested-tint: oklch(28% 0.06 25);
  --approved: oklch(74% 0.15 150);
  --approved-ink: oklch(82% 0.12 150);
  --approved-tint: oklch(27% 0.05 150);
  --shadow: 0 1px 2px oklch(8% 0.01 285 / 0.5), 0 6px 16px oklch(8% 0.01 285 / 0.35);
  color-scheme: dark;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-body);
  font-size: var(--fs-2);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }
a { color: inherit; text-decoration: none; }
a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.icon, .shape { flex: none; display: block; }

.page { max-width: 1360px; margin-inline: auto; padding-block: var(--s6) var(--s7); display: flex; flex-direction: column; gap: var(--s5); }

.masthead { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: var(--s4) var(--s6); }
.masthead-id { min-width: 0; }
.eyebrow, .att-title, .meta dt { font-size: var(--fs-1); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-2); }
.eyebrow { margin: 0 0 var(--s2); }
h1 { margin: 0; font-family: var(--font-display); font-size: var(--fs-6); font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; text-wrap: balance; overflow-wrap: anywhere; }
h1 .owner { color: var(--fg-2); font-weight: 500; }
.meta { display: flex; flex-wrap: wrap; gap: var(--s3) var(--s5); margin: 0; }
.meta div { display: flex; flex-direction: column; gap: 2px; }
.meta dd { margin: 0; font-weight: 500; }

.overview { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--s5); padding: var(--s5); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-l); }
.split { display: flex; flex-direction: column; justify-content: center; gap: var(--s4); min-width: 0; }
.split-total { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--s2) var(--s3); margin: 0; }
.split-total strong { font-family: var(--font-display); font-size: var(--fs-6); font-weight: 800; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.split-total span { color: var(--fg-2); }
.bar { display: flex; gap: 3px; height: 16px; border-radius: 999px; overflow: hidden; background: var(--sunken); }
.bar i { display: block; flex-basis: 0; flex-shrink: 1; min-width: 8px; background: var(--g); }
.legend { display: flex; flex-wrap: wrap; gap: var(--s2) var(--s5); margin: 0; padding: 0; list-style: none; }
.legend li { display: inline-flex; align-items: center; gap: var(--s2); color: var(--fg-2); }
.legend .shape { color: var(--g); }
.legend b { font-family: var(--font-mono); font-weight: 600; color: var(--fg); font-variant-numeric: tabular-nums; }
.att-title { margin: 0 0 var(--s3); }
.attention dl { margin: 0; display: flex; flex-direction: column; gap: var(--s2); }
.att { display: grid; grid-template-columns: 3ch minmax(0, 1fr); column-gap: var(--s3); align-items: baseline; }
.att dd { grid-column: 1; grid-row: 1; margin: 0; text-align: right; font-family: var(--font-mono); font-weight: 600; font-variant-numeric: tabular-nums; }
.att dt { grid-column: 2; grid-row: 1; }
.att-awaiting dd { color: var(--accent); }
.att-ready dd { color: var(--approved-ink); }
.att-failing dd { color: var(--changes_requested-ink); }
.att-stale dd { color: var(--unreviewed-ink); }
.att.is-zero dd, .att.is-zero dt { color: var(--fg-2); }
@media (min-width: 860px) {
  .overview { grid-template-columns: minmax(0, 1fr) minmax(240px, 300px); gap: var(--s6); }
  .attention { border-left: 1px solid var(--line); padding-left: var(--s6); }
}

.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); padding-block: var(--s3); background: var(--bg); z-index: 5; }
@media (min-width: 760px) { .toolbar { position: sticky; top: env(safe-area-inset-top, 0px); } }
.search, .select { position: relative; display: block; min-width: 0; }
.search { flex: 1 1 280px; }
.search .icon { position: absolute; left: 14px; top: 50%; translate: 0 -50%; color: var(--fg-2); pointer-events: none; }
.search input, .select select { width: 100%; height: var(--control); border: 1px solid var(--line-strong); border-radius: var(--radius-m); background: var(--surface); color: var(--fg); font: inherit; }
.search input { padding: 0 var(--s4) 0 40px; }
.search input::placeholder { color: var(--fg-2); }
.select select { appearance: none; padding: 0 40px 0 var(--s4); cursor: pointer; }
.select .icon { position: absolute; right: 14px; top: 50%; translate: 0 -50%; color: var(--fg-2); pointer-events: none; }
.search input:focus-visible, .select select:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.toggle { position: relative; display: inline-flex; align-items: center; gap: var(--s2); height: var(--control); padding: 0 var(--s4) 0 var(--s3); border: 1px solid var(--line-strong); border-radius: var(--radius-m); background: var(--surface); font-weight: 500; cursor: pointer; user-select: none; }
.toggle input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.tick { display: grid; place-items: center; width: 18px; height: 18px; border: 1.5px solid var(--line-strong); border-radius: 5px; color: transparent; }
.toggle:has(input:checked) { border-color: var(--accent); background: var(--accent-tint); }
.toggle:has(input:checked) .tick { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
.toggle:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
.showing { margin: 0 0 0 auto; padding-inline: var(--s2); color: var(--fg-2); white-space: nowrap; }
.showing b { font-family: var(--font-mono); font-weight: 600; color: var(--fg); font-variant-numeric: tabular-nums; }

.lanes { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--s4); align-items: start; }
@media (min-width: 1080px) { .lanes { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.lane-unreviewed, .lane-unreviewed .card, .lg-unreviewed, .seg-unreviewed { --g: var(--unreviewed); --g-ink: var(--unreviewed-ink); }
.lane-changes_requested, .lane-changes_requested .card, .lg-changes_requested, .seg-changes_requested { --g: var(--changes_requested); --g-ink: var(--changes_requested-ink); }
.lane-approved, .lane-approved .card, .lg-approved, .seg-approved { --g: var(--approved); --g-ink: var(--approved-ink); }
.lane { min-width: 0; display: flex; flex-direction: column; gap: var(--s3); padding: var(--s3); background: color-mix(in oklab, var(--g) 7%, var(--bg)); border: 1px solid color-mix(in oklab, var(--g) 18%, var(--line)); border-radius: var(--radius-l); }
.lane-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; column-gap: var(--s3); row-gap: 2px; padding: var(--s2) var(--s2) var(--s1); }
.lane-head .shape { color: var(--g); }
.lane-head h2 { margin: 0; font-family: var(--font-display); font-size: var(--fs-3); font-weight: 700; line-height: 1.15; letter-spacing: -0.01em; }
.lane-count { font-family: var(--font-mono); font-size: var(--fs-3); font-weight: 600; color: var(--g-ink); font-variant-numeric: tabular-nums; }
.lane-hint { grid-column: 2 / 4; margin: 0; font-size: var(--fs-1); color: var(--g-ink); }
.cards { display: flex; flex-direction: column; gap: var(--s3); }
.empty { margin: 0; padding: var(--s5) var(--s4); border: 1px dashed color-mix(in oklab, var(--g) 35%, var(--line)); border-radius: var(--radius-m); text-align: center; font-size: var(--fs-1); color: var(--g-ink); }

.card { min-width: 0; display: flex; flex-direction: column; gap: var(--s3); padding: var(--s4); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-m); }
.card:hover { border-color: var(--line-strong); box-shadow: var(--shadow); }
.card.is-awaiting { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.card.is-awaiting:hover { box-shadow: 0 0 0 1px var(--accent), var(--shadow); }
.card.is-draft { background: color-mix(in oklab, var(--surface) 55%, transparent); border-style: dashed; border-color: var(--line-strong); }
@media (prefers-reduced-motion: no-preference) {
  .card { transition: transform 0.35s var(--ease-out); }
  .card:hover { transform: translateY(-2px); }
}
.card-head { display: flex; align-items: center; gap: var(--s2); min-width: 0; font-family: var(--font-mono); font-size: var(--fs-1); color: var(--fg-2); font-variant-numeric: tabular-nums; }
.card-head .shape { color: var(--g); }
.num { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.num:hover { color: var(--accent); }
.ci { display: inline-flex; align-items: center; gap: var(--s1); margin-left: auto; white-space: nowrap; }
.ci-passing { color: var(--approved-ink); }
.ci-failing { color: var(--changes_requested-ink); font-weight: 600; }
.ci-pending { color: var(--unreviewed-ink); }
.ci-none { color: var(--fg-2); }
.age { min-width: 4ch; text-align: right; }
.card-title { margin: 0; font-size: var(--fs-2); font-weight: 600; line-height: 1.35; text-wrap: pretty; overflow-wrap: anywhere; }
.card-title a:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
.byline { display: flex; align-items: center; gap: var(--s2); min-width: 0; font-size: var(--fs-1); color: var(--fg-2); }
.avatar { position: relative; flex: none; display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; overflow: hidden; background: var(--sunken); color: var(--fg); font-size: 10px; font-weight: 700; }
.avatar::before { content: attr(data-initial); }
.avatar img { position: absolute; inset: 0; width: 100%; height: 100%; }
.author { flex: none; font-weight: 600; color: var(--fg); }
.branch { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); }

.flags, .reviewers, .labels { display: flex; flex-wrap: wrap; gap: var(--s1) var(--s2); margin: 0; padding: 0; list-style: none; }
.flag { display: inline-flex; align-items: center; gap: var(--s1); height: 24px; padding: 0 var(--s2); border-radius: var(--radius-s); font-size: var(--fs-1); font-weight: 600; background: var(--sunken); color: var(--fg); }
.flag-awaiting_you { background: var(--accent); color: var(--on-accent); }
.flag-mine { background: var(--accent-tint); color: var(--accent); }
.flag-partial { background: var(--approved-tint); color: var(--approved-ink); }
.flag-commented, .flag-stale { background: var(--unreviewed-tint); color: var(--unreviewed-ink); }
.flag-conflict { background: var(--changes_requested-tint); color: var(--changes_requested-ink); }
.flag-draft { background: transparent; border: 1px dashed var(--line-strong); }

.card-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s2) var(--s3); padding-top: var(--s3); border-top: 1px solid var(--line); }
.rev { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 var(--s2) 0 6px; border: 1px solid var(--line); border-radius: 999px; font-size: var(--fs-1); }
.rev .shape { color: var(--r); }
.rev-approved { --r: var(--approved); }
.rev-changes_requested { --r: var(--changes_requested); }
.rev-unreviewed { --r: var(--unreviewed); }
.rev-requested { --r: var(--fg-2); border-style: dashed; color: var(--fg-2); }
.rev-none { margin: 0; font-size: var(--fs-1); color: var(--fg-2); }
.diff { display: inline-flex; align-items: center; gap: var(--s2); margin-left: auto; font-family: var(--font-mono); font-size: var(--fs-1); font-variant-numeric: tabular-nums; }
.diff .add { color: var(--approved-ink); }
.diff .del { color: var(--changes_requested-ink); }
.diffbar { display: block; width: 48px; height: 6px; border-radius: 999px; overflow: hidden; background: var(--changes_requested); }
.diffbar i { display: block; height: 100%; background: var(--approved); box-shadow: 2px 0 0 var(--surface); }
.diffbar.is-empty { background: var(--sunken); }
.label { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 var(--s2); border: 1px solid var(--line); border-radius: 999px; font-size: var(--fs-1); color: var(--fg-2); }
.label i { width: 8px; height: 8px; border-radius: 50%; background: var(--label, var(--line-strong)); box-shadow: 0 0 0 1px color-mix(in oklab, var(--fg) 14%, transparent); }

.nothing { display: flex; flex-direction: column; align-items: center; gap: var(--s3); padding: var(--s7) var(--s5); background: var(--surface); border: 1px dashed var(--line-strong); border-radius: var(--radius-l); text-align: center; }
.nothing-shapes { display: flex; gap: var(--s2); }
.nothing-shapes .lg-unreviewed { color: var(--unreviewed); }
.nothing-shapes .lg-changes_requested { color: var(--changes_requested); }
.nothing-shapes .lg-approved { color: var(--approved); }
.nothing p { margin: 0; font-family: var(--font-display); font-size: var(--fs-4); font-weight: 700; letter-spacing: -0.01em; }

.foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--s2) var(--s4); font-family: var(--font-mono); font-size: var(--fs-1); color: var(--fg-2); }
.foot kbd { font-family: inherit; padding: 1px 6px; border: 1px solid var(--line-strong); border-radius: 4px; background: var(--surface); color: var(--fg); }

@media (max-width: 600px) {
  h1, .split-total strong { font-size: var(--fs-5); }
  .showing { margin-left: 0; }
}
`;

const SCRIPT = `
(function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  if (!cards.length) return;
  var byId = function (id) { return document.getElementById(id); };
  var q = byId('q'), author = byId('author'), awaiting = byId('awaiting'), mine = byId('mine'), drafts = byId('drafts');
  var groups = __GROUPS__;
  function setText(selector, value) {
    var el = document.querySelector(selector);
    if (el) el.textContent = value;
  }
  function apply() {
    var needle = (q.value || '').trim().toLowerCase();
    var who = author.value;
    var counts = {}, visible = 0;
    groups.forEach(function (g) { counts[g] = 0; });
    cards.forEach(function (card) {
      var show = true;
      if (needle && card.getAttribute('data-search').indexOf(needle) === -1) show = false;
      if (who && card.getAttribute('data-author') !== who) show = false;
      if (awaiting && awaiting.checked && card.getAttribute('data-awaiting') !== '1') show = false;
      if (mine && mine.checked && card.getAttribute('data-mine') !== '1') show = false;
      if (!drafts.checked && card.getAttribute('data-draft') === '1') show = false;
      card.hidden = !show;
      if (show) { visible++; counts[card.getAttribute('data-group')]++; }
    });
    groups.forEach(function (g) {
      setText('[data-count="' + g + '"]', counts[g]);
      setText('[data-legend="' + g + '"]', counts[g]);
      var empty = document.querySelector('[data-empty="' + g + '"]');
      if (empty) empty.hidden = counts[g] > 0;
      var seg = document.querySelector('[data-seg="' + g + '"]');
      if (seg) { seg.style.flexGrow = counts[g]; seg.hidden = counts[g] === 0; }
    });
    setText('[data-visible]', visible);
  }
  [q, author, awaiting, mine, drafts].forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', apply);
    el.addEventListener('change', apply);
  });
  document.addEventListener('keydown', function (event) {
    var tag = (event.target && event.target.tagName) || '';
    if (event.key === '/' && !/^(INPUT|SELECT|TEXTAREA)$/.test(tag)) { event.preventDefault(); q.focus(); }
    if (event.key === 'Escape' && event.target === q && q.value) { q.value = ''; apply(); }
  });
  try {
    var params = new URLSearchParams(location.search);
    if (params.get('awaiting') === '1' && awaiting) { awaiting.checked = true; apply(); }
  } catch (error) {
    console.warn('pr-review-board: could not read the URL filters', error);
  }
})();
`;

export function renderHtml(board, { lang = 'en' } = {}) {
  const t = strings(lang);
  const { totals } = board;
  const multiRepo = board.repos.length > 1;
  const repoLabel = board.repos.length ? board.repos.join(', ') : '';
  const authors = [...new Set(GROUPS.flatMap((g) => board.groups[g].map((pr) => pr.author)))].sort((a, b) => a.localeCompare(b));
  const pageTitle = `${t.title}${repoLabel ? ` · ${repoLabel}` : ''}`;
  const heading = board.repos.length ? board.repos.map(repoHeading).join(', ') : esc(t.title);
  const barLabel = GROUPS.map((g) => `${totals[g]} ${t.groupsShort[g]}`).join(', ');
  const empty = totals.open === 0;

  const overview = `
  <section class="overview" aria-label="${esc(t.title)}">
    <div class="split">
      <p class="split-total"><strong>${totals.open}</strong><span>${esc(t.openLabel)}</span></p>
      <div class="bar" role="img" aria-label="${esc(barLabel)}">
        ${GROUPS.map((g) => `<i class="seg-${g}" data-seg="${g}" style="flex-grow:${totals[g]}"${totals[g] ? '' : ' hidden'}></i>`).join('')}
      </div>
      <ul class="legend">
        ${GROUPS.map((g) => `<li class="lg-${g}">${shapeSvg(g, 14)}<b data-legend="${g}">${totals[g]}</b>${esc(t.groupsShort[g])}</li>`).join('')}
      </ul>
    </div>
    <div class="attention">
      <h2 class="att-title">${esc(t.attention)}</h2>
      <dl>${attentionList(board, t)}</dl>
    </div>
  </section>`;

  const body = empty
    ? `
  <section class="nothing">
    <div class="nothing-shapes">${GROUPS.map((g) => `<span class="lg-${g}">${shapeSvg(g, 18)}</span>`).join('')}</div>
    <p>${esc(t.noPrs)}</p>
  </section>`
    : `${overview}
  ${toolbar(board, t, authors)}
  <main class="lanes">${GROUPS.map((g) => lane(g, board.groups[g], t, multiRepo)).join('')}
  </main>`;

  return `<!doctype html>
<html lang="${lang === 'pt' ? 'pt-BR' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(pageTitle)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS_URL}">
<style>${STYLES}</style>
</head>
<body>
<div class="page">
  <header class="masthead">
    <div class="masthead-id">
      <p class="eyebrow">${esc(t.eyebrow)}</p>
      <h1>${heading}</h1>
    </div>
    <dl class="meta">
      <div><dt>${esc(t.generated)}</dt><dd>${esc(formatDate(board.generatedAt, lang))}</dd></div>
      ${board.viewer ? `<div><dt>${esc(t.viewer)}</dt><dd>${esc(board.viewer)}</dd></div>` : ''}
    </dl>
  </header>
  ${body}
  <footer class="foot">
    <span>pr-review-board · ${esc(board.generatedAt)}</span>
    ${empty ? '' : `<span>${t.searchHint('<kbd>/</kbd>')}</span>`}
  </footer>
</div>
<script>${SCRIPT.replace('__GROUPS__', JSON.stringify(GROUPS))}</script>
</body>
</html>
`;
}
