// Everything that talks to the gh CLI lives here, so the rest of the script
// can run offline on a saved fixture.
import { execFileSync } from 'node:child_process';

export const PR_FIELDS = [
  'number',
  'title',
  'url',
  'author',
  'isDraft',
  'createdAt',
  'updatedAt',
  'reviewDecision',
  'latestReviews',
  'reviewRequests',
  'labels',
  'headRefName',
  'baseRefName',
  'additions',
  'deletions',
  'statusCheckRollup',
  'mergeable',
];

export class GhError extends Error {
  constructor(message, { hint = null, cause = null } = {}) {
    super(message);
    this.name = 'GhError';
    this.hint = hint;
    this.cause = cause;
  }
}

function gh(args) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GH_PROMPT_DISABLED: '1', NO_COLOR: '1' },
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new GhError('the GitHub CLI (gh) is not installed or not on PATH', {
        hint: 'install it from https://cli.github.com and run `gh auth login`',
      });
    }
    const stderr = String(error.stderr || '').trim();
    if (/not logged in|auth login|authentication|GH_TOKEN|HTTP 401/i.test(stderr)) {
      throw new GhError('gh is not authenticated for github.com', { hint: 'run `gh auth login` and try again', cause: stderr });
    }
    throw new GhError(`gh ${args.slice(0, 2).join(' ')} failed`, { cause: stderr || error.message });
  }
}

export function currentRepo() {
  try {
    return gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim() || null;
  } catch {
    return null;
  }
}

export function viewerLogin() {
  try {
    return gh(['api', 'user', '--jq', '.login']).trim() || null;
  } catch {
    return null;
  }
}

export function fetchOpenPrs(repo, { limit = 100, author = null, search = null } = {}) {
  const args = ['pr', 'list', '--state', 'open', '--limit', String(limit), '--json', PR_FIELDS.join(',')];
  if (repo) args.push('--repo', repo);
  if (author) args.push('--author', author);
  if (search) args.push('--search', search);
  const parsed = JSON.parse(gh(args));
  if (!Array.isArray(parsed)) throw new GhError('unexpected output from gh pr list', { cause: JSON.stringify(parsed).slice(0, 200) });
  return parsed;
}
