// User-facing strings for the Markdown summary and the HTML board.
const STRINGS = {
  en: {
    title: 'Open pull requests',
    generated: 'Generated',
    viewer: 'Signed in as',
    repos: 'Repositories',
    noPrs: 'No open pull requests.',
    groups: { unreviewed: 'Not reviewed', changes_requested: 'Changes requested', approved: 'Approved' },
    groupsShort: { unreviewed: 'not reviewed', changes_requested: 'changes requested', approved: 'approved' },
    stats: {
      awaitingYou: 'Awaiting your review',
      mine: 'Yours',
      drafts: 'Drafts',
      ciFailing: 'CI failing',
      stale: (days) => `Idle for ${days}+ days`,
      readyToMerge: 'Approved and green',
    },
    badges: {
      draft: 'draft',
      awaiting_you: 'awaiting you',
      mine: 'yours',
      partial: 'partially approved',
      commented: 'commented',
      stale: 'stale',
      conflict: 'conflicts',
    },
    badgeTitles: {
      partial: 'Has approvals but the branch still requires review',
      commented: 'Someone commented without approving or requesting changes',
      stale: 'No activity for a while',
      conflict: 'Cannot be merged until conflicts are resolved',
    },
    ci: { passing: 'checks passing', failing: 'checks failing', pending: 'checks running', none: 'no checks' },
    columns: { pr: 'PR', title: 'Title', author: 'Author', age: 'Age', ci: 'CI', reviews: 'Reviews' },
    reviewStates: { APPROVED: 'approved', CHANGES_REQUESTED: 'requested changes', COMMENTED: 'commented' },
    requested: 'requested',
    noReviews: 'nobody yet',
    days: (n) => `${n}d`,
    filters: { search: 'Search title, author, branch, label', awaitingYou: 'Awaiting me', mine: 'My PRs', drafts: 'Show drafts', allAuthors: 'All authors' },
    emptyColumn: 'Nothing here',
    legendHint: 'Shapes repeat the colors:',
    files: { json: 'Data', html: 'Board' },
    opened: 'opened',
    idle: 'last activity',
    idleShort: 'idle',
    into: 'into',
    team: 'team',
  },
  pt: {
    title: 'Pull requests abertas',
    generated: 'Gerado em',
    viewer: 'Logado como',
    repos: 'Repositórios',
    noPrs: 'Nenhuma pull request aberta.',
    groups: { unreviewed: 'Não revisadas', changes_requested: 'Modificações solicitadas', approved: 'Aprovadas' },
    groupsShort: { unreviewed: 'não revisadas', changes_requested: 'com modificações solicitadas', approved: 'aprovadas' },
    stats: {
      awaitingYou: 'Aguardando sua revisão',
      mine: 'Suas',
      drafts: 'Rascunhos',
      ciFailing: 'CI falhando',
      stale: (days) => `Paradas há ${days}+ dias`,
      readyToMerge: 'Aprovadas e verdes',
    },
    badges: {
      draft: 'rascunho',
      awaiting_you: 'aguardando você',
      mine: 'sua',
      partial: 'aprovação parcial',
      commented: 'comentada',
      stale: 'parada',
      conflict: 'conflito',
    },
    badgeTitles: {
      partial: 'Tem aprovações, mas a branch ainda exige revisão',
      commented: 'Alguém comentou sem aprovar nem pedir mudanças',
      stale: 'Sem atividade há um tempo',
      conflict: 'Não pode ser mesclada até resolver os conflitos',
    },
    ci: { passing: 'checks passando', failing: 'checks falhando', pending: 'checks rodando', none: 'sem checks' },
    columns: { pr: 'PR', title: 'Título', author: 'Autor', age: 'Idade', ci: 'CI', reviews: 'Revisões' },
    reviewStates: { APPROVED: 'aprovou', CHANGES_REQUESTED: 'pediu mudanças', COMMENTED: 'comentou' },
    requested: 'solicitado',
    noReviews: 'ninguém ainda',
    days: (n) => `${n}d`,
    filters: { search: 'Buscar por título, autor, branch, label', awaitingYou: 'Aguardando mim', mine: 'Minhas PRs', drafts: 'Mostrar rascunhos', allAuthors: 'Todos os autores' },
    emptyColumn: 'Nada por aqui',
    legendHint: 'As formas repetem as cores:',
    files: { json: 'Dados', html: 'Board' },
    opened: 'aberta há',
    idle: 'última atividade há',
    idleShort: 'parada',
    into: 'em',
    team: 'time',
  },
};

export const SHAPES = { unreviewed: '○', changes_requested: '◐', approved: '●' };
export const BAR_CHARS = { unreviewed: '░', changes_requested: '▒', approved: '█' };
export const CI_MARKS = { passing: '✓', failing: '✗', pending: '…', none: '–' };

export function strings(lang) {
  return STRINGS[lang] || STRINGS.en;
}

export function supportedLanguages() {
  return Object.keys(STRINGS);
}
