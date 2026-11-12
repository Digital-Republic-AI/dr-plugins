// Renders the board as one self-contained HTML page: three columns, one per
// review decision, each with its own color and shape, plus a stacked bar and
// filters. No external assets except the GitHub avatars.
import { GROUPS } from './classify.mjs';
import { strings } from './i18n.mjs';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function labelTextColor(hex) {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return '#1f2328';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.55 ? '#1f2328' : '#ffffff';
}

// Inline SVG instead of the ○ ◐ ● glyphs: fonts render the half circle at
// very different sizes, and the shapes must read the same everywhere.
export function shapeSvg(group, size = 14) {
  const fill = { unreviewed: '', changes_requested: '<path d="M8 1.5a6.5 6.5 0 0 0 0 13z" fill="currentColor"/>', approved: '<circle cx="8" cy="8" r="6.5" fill="currentColor"/>' }[group] || '';
  return `<svg class="shape shape-${group}" width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/>${fill}</svg>`;
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

function card(pr, t, lang, multiRepo) {
  const total = pr.additions + pr.deletions;
  const addShare = total ? Math.round((pr.additions / total) * 100) : 50;
  const badges = pr.badges
    .map((b) => `<span class="badge badge-${b}" title="${esc(t.badgeTitles[b] || '')}">${esc(t.badges[b] || b)}</span>`)
    .join('');
  const reviews = pr.reviews
    .map((r) => {
      const g = reviewGroup(r.state);
      return `<span class="rev rev-${g}" title="${esc(r.login)} ${esc(t.reviewStates[r.state] || r.state.toLowerCase())}">${shapeSvg(g, 10)} ${esc(r.login)}</span>`;
    })
    .join('');
  const pending = pr.requested
    .filter((r) => !pr.reviews.some((rev) => rev.login === r.login))
    .map((r) => `<span class="rev rev-pending" title="${esc(t.requested)}">? ${r.team ? '@' : ''}${esc(r.login)}</span>`)
    .join('');
  const labels = pr.labels
    .map((l) => {
      const bg = l.color ? `#${l.color}` : 'var(--border)';
      return `<span class="label" style="background:${esc(bg)};color:${labelTextColor(l.color)}">${esc(l.name)}</span>`;
    })
    .join('');
  const ciTitle = `${t.ci[pr.ci.state]}${pr.ci.total ? ` (${pr.ci.passed}/${pr.ci.total})` : ''}`;
  const ref = multiRepo && pr.repo ? `${esc(pr.repo)}#${pr.number}` : `#${pr.number}`;
  const search = [pr.title, pr.author, pr.headRefName, pr.baseRefName, ...pr.labels.map((l) => l.name), ...pr.reviews.map((r) => r.login), String(pr.number)]
    .join(' ')
    .toLowerCase();
  const ageTitle = `${t.opened} ${pr.daysOpen ?? '?'}d · ${t.idle} ${pr.daysIdle ?? '?'}d`;
  return `
      <article class="card card-${pr.group}${pr.isDraft ? ' is-draft' : ''}${pr.awaitingYou ? ' is-awaiting' : ''}"
        data-author="${esc(pr.author)}" data-draft="${pr.isDraft ? 1 : 0}" data-awaiting="${pr.awaitingYou ? 1 : 0}" data-mine="${pr.badges.includes('mine') ? 1 : 0}" data-search="${esc(search)}">
        <div class="card-top">
          <a class="num" href="${esc(pr.url)}" target="_blank" rel="noopener">${ref}</a>
          <span class="ci ci-${pr.ci.state}" title="${esc(ciTitle)}"><i></i>${esc(t.ci[pr.ci.state])}</span>
          <span class="age${pr.badges.includes('stale') ? ' age-stale' : ''}" title="${esc(ageTitle)}">${pr.daysOpen ?? '?'}d</span>
        </div>
        <a class="title" href="${esc(pr.url)}" target="_blank" rel="noopener">${esc(pr.title)}</a>
        <div class="meta">
          <span class="avatar" data-initial="${esc(pr.author.replace(/[^a-z0-9]/gi, '').charAt(0).toUpperCase() || '?')}"><img src="https://avatars.githubusercontent.com/${esc(pr.author)}?s=40" alt="" loading="lazy" onerror="this.remove()"></span>
          <span class="author">${esc(pr.author)}</span>
          <span class="branch" title="${esc(pr.headRefName)} → ${esc(pr.baseRefName)}">${esc(pr.headRefName)} <span class="arrow">→</span> ${esc(pr.baseRefName)}</span>
        </div>
        ${badges ? `<div class="badges">${badges}</div>` : ''}
        <div class="diff" title="+${pr.additions} / -${pr.deletions}">
          <span class="add">+${pr.additions}</span><span class="del">-${pr.deletions}</span>
          <span class="diffbar"><i style="width:${addShare}%"></i></span>
        </div>
        <div class="reviews">${reviews}${pending}${!reviews && !pending ? `<span class="rev rev-none">${esc(t.noReviews)}</span>` : ''}</div>
        ${labels ? `<div class="labels">${labels}</div>` : ''}
      </article>`;
}

function column(group, prs, t, lang, multiRepo) {
  const cards = prs.map((pr) => card(pr, t, lang, multiRepo)).join('');
  return `
    <section class="column col-${group}" data-group="${group}">
      <header class="col-head">
        ${shapeSvg(group, 18)}
        <h2>${esc(t.groups[group])}</h2>
        <span class="count" data-count>${prs.length}</span>
      </header>
      <div class="cards">${cards}
        <p class="empty"${prs.length ? ' hidden' : ''}>${esc(t.emptyColumn)}</p>
      </div>
    </section>`;
}

export function renderHtml(board, { lang = 'en' } = {}) {
  const t = strings(lang);
  const { totals } = board;
  const multiRepo = board.repos.length > 1;
  const repoLabel = board.repos.length ? board.repos.join(', ') : '';
  const pct = (g) => (totals.open ? (totals[g] / totals.open) * 100 : 0);
  const authors = [...new Set(GROUPS.flatMap((g) => board.groups[g].map((pr) => pr.author)))].sort((a, b) => a.localeCompare(b));
  const stats = [
    board.viewer ? ['awaitingYou', t.stats.awaitingYou, totals.awaitingYou, 'stat-awaiting'] : null,
    ['readyToMerge', t.stats.readyToMerge, totals.readyToMerge, 'stat-ready'],
    ['ciFailing', t.stats.ciFailing, totals.ciFailing, 'stat-failing'],
    ['stale', t.stats.stale(board.staleDays), totals.stale, 'stat-stale'],
    ['drafts', t.stats.drafts, totals.drafts, 'stat-draft'],
  ].filter(Boolean);
  const pageTitle = `${t.title}${repoLabel ? ` · ${repoLabel}` : ''}`;

  return `<!doctype html>
<html lang="${lang === 'pt' ? 'pt-BR' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<style>
:root {
  --bg: #f6f8fa; --surface: #ffffff; --text: #1f2328; --muted: #656d76; --border: #d0d7de; --accent: #0969da;
  --unreviewed: #9a6700; --unreviewed-bg: #fff8c5; --unreviewed-soft: #f5e6a3;
  --changes_requested: #cf222e; --changes_requested-bg: #ffebe9; --changes_requested-soft: #f7c6c3;
  --approved: #1a7f37; --approved-bg: #dafbe1; --approved-soft: #aceebb;
  --pending: #8c959f; --fail: #cf222e; --pass: #1a7f37; --running: #bf8700;
  --awaiting: #8250df; --awaiting-bg: #fbefff;
  --shadow: 0 1px 2px rgba(31, 35, 40, .08);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0d1117; --surface: #161b22; --text: #e6edf3; --muted: #8d96a0; --border: #30363d; --accent: #58a6ff;
    --unreviewed: #e3b341; --unreviewed-bg: #2a2309; --unreviewed-soft: #4a3d0f;
    --changes_requested: #ff7b72; --changes_requested-bg: #3a1a1b; --changes_requested-soft: #5c2426;
    --approved: #3fb950; --approved-bg: #12301b; --approved-soft: #1d4a2a;
    --pending: #6e7681; --fail: #ff7b72; --pass: #3fb950; --running: #d29922;
    --awaiting: #bc8cff; --awaiting-bg: #2a1f3d;
    --shadow: 0 1px 2px rgba(0, 0, 0, .4);
  }
}
:root[data-theme="dark"] {
  --bg: #0d1117; --surface: #161b22; --text: #e6edf3; --muted: #8d96a0; --border: #30363d; --accent: #58a6ff;
  --unreviewed: #e3b341; --unreviewed-bg: #2a2309; --unreviewed-soft: #4a3d0f;
  --changes_requested: #ff7b72; --changes_requested-bg: #3a1a1b; --changes_requested-soft: #5c2426;
  --approved: #3fb950; --approved-bg: #12301b; --approved-soft: #1d4a2a;
  --pending: #6e7681; --fail: #ff7b72; --pass: #3fb950; --running: #d29922;
  --awaiting: #bc8cff; --awaiting-bg: #2a1f3d;
  --shadow: 0 1px 2px rgba(0, 0, 0, .4);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
a { color: inherit; text-decoration: none; }
.wrap { max-width: 1400px; margin: 0 auto; padding: 20px 16px 48px; }
header.page h1 { font-size: 20px; margin: 0 0 2px; }
header.page .sub { color: var(--muted); font-size: 13px; display: flex; flex-wrap: wrap; gap: 4px 14px; }
.summary { margin: 16px 0 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; box-shadow: var(--shadow); }
.bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; background: var(--border); }
.bar i { display: block; height: 100%; transition: width .2s; }
.bar .seg-unreviewed { background: var(--unreviewed); }
.bar .seg-changes_requested { background: var(--changes_requested); }
.bar .seg-approved { background: var(--approved); }
.legend { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 10px; font-size: 13px; }
.legend span { display: inline-flex; align-items: center; gap: 5px; }
.legend .lg-unreviewed { color: var(--unreviewed); }
.legend .lg-changes_requested { color: var(--changes_requested); }
.legend .lg-approved { color: var(--approved); }
.legend .hint { color: var(--muted); flex-basis: 100%; font-size: 12px; display: flex; flex-wrap: wrap; gap: 4px 8px; }
.stats { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.stat { border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; font-size: 12px; color: var(--muted); background: var(--bg); }
.stat b { color: var(--text); font-size: 13px; margin-right: 4px; }
.stat.stat-awaiting b { color: var(--awaiting); }
.stat.stat-ready b { color: var(--approved); }
.stat.stat-failing b { color: var(--fail); }
.stat.stat-stale b { color: var(--running); }
.stat.is-zero { opacity: .6; }
.filters { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin: 0 0 14px; font-size: 13px; }
.filters input[type=search] { flex: 1 1 220px; min-width: 180px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font: inherit; }
.filters select { padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font: inherit; }
.filters label { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
.board { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
@media (max-width: 960px) { .board { grid-template-columns: 1fr; } }
.column { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; border-top-width: 4px; box-shadow: var(--shadow); min-height: 120px; }
.col-unreviewed { border-top-color: var(--unreviewed); }
.col-changes_requested { border-top-color: var(--changes_requested); }
.col-approved { border-top-color: var(--approved); }
.col-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--border); }
.col-head h2 { font-size: 14px; margin: 0; flex: 1; }
.col-head .shape { flex: none; }
.col-unreviewed .col-head .shape, .col-unreviewed .col-head .count { color: var(--unreviewed); }
.col-changes_requested .col-head .shape, .col-changes_requested .col-head .count { color: var(--changes_requested); }
.col-approved .col-head .shape, .col-approved .col-head .count { color: var(--approved); }
.col-unreviewed .col-head .count { background: var(--unreviewed-bg); }
.col-changes_requested .col-head .count { background: var(--changes_requested-bg); }
.col-approved .col-head .count { background: var(--approved-bg); }
.col-head .count { font-weight: 600; border-radius: 999px; padding: 1px 9px; font-size: 12px; }
.cards { padding: 10px; display: flex; flex-direction: column; gap: 10px; }
.empty { color: var(--muted); text-align: center; margin: 24px 0; font-size: 13px; }
.column { min-width: 0; }
.card { position: relative; min-width: 0; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px 10px 16px; background: var(--surface); display: flex; flex-direction: column; gap: 6px; }
.card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; border-radius: 8px 0 0 8px; }
.card-unreviewed::before { background: var(--unreviewed); }
.card-changes_requested::before { background: var(--changes_requested); }
.card-approved::before { background: var(--approved); }
.card.is-draft { opacity: .72; border-style: dashed; }
.card.is-awaiting { box-shadow: 0 0 0 2px var(--awaiting); }
.card-top { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
.card-top .num { font-weight: 600; color: var(--accent); }
.card-top .age { margin-left: auto; font-variant-numeric: tabular-nums; }
.card-top .age-stale { color: var(--running); font-weight: 600; }
.card-top .age-stale::before { content: "⏱ "; }
.ci { display: inline-flex; align-items: center; gap: 5px; }
.ci i { width: 9px; height: 9px; border-radius: 50%; background: var(--pending); display: inline-block; }
.ci-passing i { background: var(--pass); }
.ci-failing i { background: var(--fail); box-shadow: 0 0 0 3px color-mix(in srgb, var(--fail) 25%, transparent); }
.ci-pending i { background: var(--running); }
.ci-none { opacity: .7; }
.title { font-weight: 600; font-size: 14px; line-height: 1.35; }
.title:hover { color: var(--accent); text-decoration: underline; }
.meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); min-width: 0; max-width: 100%; }
.card-top { min-width: 0; }
.card-top .num { flex: none; }
.avatar { position: relative; width: 18px; height: 18px; border-radius: 50%; flex: none; background: var(--border); color: var(--text); font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; }
.avatar::before { content: attr(data-initial); }
.avatar img { position: absolute; inset: 0; width: 100%; height: 100%; }
.author { font-weight: 600; color: var(--text); }
.branch { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.branch .arrow { color: var(--muted); }
.badges, .labels, .reviews { display: flex; flex-wrap: wrap; gap: 4px; }
.badge { font-size: 11px; border-radius: 999px; padding: 1px 8px; border: 1px solid var(--border); color: var(--muted); }
.badge-awaiting_you { color: var(--awaiting); border-color: var(--awaiting); background: var(--awaiting-bg); font-weight: 600; }
.badge-draft { border-style: dashed; }
.badge-mine { color: var(--accent); border-color: var(--accent); }
.badge-partial { color: var(--approved); border-color: var(--approved-soft); background: var(--approved-bg); }
.badge-commented { color: var(--unreviewed); border-color: var(--unreviewed-soft); background: var(--unreviewed-bg); }
.badge-stale { color: var(--running); }
.badge-conflict { color: var(--fail); border-color: var(--fail); }
.diff { display: flex; align-items: center; gap: 6px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.diff .add { color: var(--pass); } .diff .del { color: var(--fail); }
.diffbar { flex: 1; height: 5px; background: var(--fail); border-radius: 3px; overflow: hidden; max-width: 140px; opacity: .85; }
.diffbar i { display: block; height: 100%; background: var(--pass); }
.rev { font-size: 11px; border-radius: 4px; padding: 1px 6px; border: 1px solid var(--border); display: inline-flex; align-items: center; gap: 4px; }
.rev .shape { flex: none; }
.rev-approved { color: var(--approved); background: var(--approved-bg); border-color: var(--approved-soft); }
.rev-changes_requested { color: var(--changes_requested); background: var(--changes_requested-bg); border-color: var(--changes_requested-soft); }
.rev-unreviewed { color: var(--unreviewed); background: var(--unreviewed-bg); border-color: var(--unreviewed-soft); }
.rev-pending { color: var(--muted); border-style: dashed; }
.rev-none { color: var(--muted); border: 0; padding-left: 0; font-style: italic; }
.label { font-size: 11px; border-radius: 999px; padding: 1px 8px; font-weight: 500; }
footer { margin-top: 20px; color: var(--muted); font-size: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <header class="page">
    <h1>${esc(t.title)}${repoLabel ? ` <span style="color:var(--muted);font-weight:400">· ${esc(repoLabel)}</span>` : ''}</h1>
    <div class="sub">
      <span>${esc(t.generated)} ${esc(formatDate(board.generatedAt, lang))}</span>
      ${board.viewer ? `<span>${esc(t.viewer)} <b>${esc(board.viewer)}</b></span>` : ''}
      <span><b data-visible>${totals.open}</b> / ${totals.open}</span>
    </div>
  </header>

  <section class="summary">
    <div class="bar" role="img" aria-label="${GROUPS.map((g) => `${totals[g]} ${esc(t.groupsShort[g])}`).join(', ')}">
      ${GROUPS.map((g) => `<i class="seg-${g}" data-seg="${g}" style="width:${pct(g).toFixed(1)}%"></i>`).join('')}
    </div>
    <div class="legend">
      ${GROUPS.map((g) => `<span class="lg-${g}">${shapeSvg(g, 14)} <strong data-legend="${g}">${totals[g]}</strong> ${esc(t.groupsShort[g])}</span>`).join('')}
      <span class="hint">${esc(t.legendHint)} ${GROUPS.map((g) => `<span class="lg-${g}">${shapeSvg(g, 11)} ${esc(t.groupsShort[g])}</span>`).join(' · ')}</span>
    </div>
    <div class="stats">
      ${stats.map(([key, label, value, cls]) => `<span class="stat ${cls}${value ? '' : ' is-zero'}"><b>${value}</b>${esc(label)}</span>`).join('')}
    </div>
  </section>

  <div class="filters">
    <input type="search" id="q" placeholder="${esc(t.filters.search)}" autocomplete="off">
    <select id="author"><option value="">${esc(t.filters.allAuthors)}</option>${authors.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}</select>
    ${board.viewer ? `<label><input type="checkbox" id="awaiting"> ${esc(t.filters.awaitingYou)}</label><label><input type="checkbox" id="mine"> ${esc(t.filters.mine)}</label>` : ''}
    <label><input type="checkbox" id="drafts" checked> ${esc(t.filters.drafts)}</label>
  </div>

  <main class="board">
    ${GROUPS.map((g) => column(g, board.groups[g], t, lang, multiRepo)).join('')}
  </main>
  <footer>pr-review-board · ${esc(board.generatedAt)}</footer>
</div>
<script>
(function () {
  var q = document.getElementById('q'), author = document.getElementById('author');
  var awaiting = document.getElementById('awaiting'), mine = document.getElementById('mine'), drafts = document.getElementById('drafts');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var groups = ${JSON.stringify(GROUPS)};
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
      if (show) { visible++; counts[card.closest('.column').getAttribute('data-group')]++; }
    });
    groups.forEach(function (g) {
      var col = document.querySelector('.col-' + g);
      col.querySelector('[data-count]').textContent = counts[g];
      col.querySelector('.empty').hidden = counts[g] > 0;
      var legend = document.querySelector('[data-legend="' + g + '"]');
      if (legend) legend.textContent = counts[g];
      var seg = document.querySelector('[data-seg="' + g + '"]');
      if (seg) seg.style.width = (visible ? (counts[g] / visible) * 100 : 0).toFixed(1) + '%';
    });
    var vis = document.querySelector('[data-visible]');
    if (vis) vis.textContent = visible;
  }
  [q, author, awaiting, mine, drafts].forEach(function (el) { if (el) el.addEventListener('input', apply); });
  try {
    var params = new URLSearchParams(location.search);
    if (params.get('awaiting') === '1' && awaiting) { awaiting.checked = true; apply(); }
  } catch (e) {}
})();
</script>
</body>
</html>
`;
}
