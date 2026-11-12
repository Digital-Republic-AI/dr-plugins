#!/usr/bin/env node
// Lists open pull requests grouped by review decision (not reviewed, changes
// requested, approved), writes a colored HTML board plus the data as JSON, and
// prints a Markdown summary for the terminal.
//
//   pr-board.mjs [--repo OWNER/NAME]... [--input FILE] [--viewer LOGIN] [--lang en|pt]
//                [--limit N] [--author LOGIN] [--search QUERY] [--no-drafts]
//                [--stale-days N] [--out DIR] [--open] [--json]
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildBoard } from './lib/classify.mjs';
import { BOARD_HTML_FILE, BOARD_JSON_FILE, SERVER_HOST } from './lib/constants.mjs';
import { GhError, currentRepo, fetchOpenPrs, viewerLogin } from './lib/fetch.mjs';
import { renderHtml } from './lib/html.mjs';
import { supportedLanguages } from './lib/i18n.mjs';
import { renderMarkdown } from './lib/markdown.mjs';
import { serveBoard } from './lib/serve.mjs';

const USAGE = `usage: pr-board.mjs [options]
  --repo OWNER/NAME   repository to read (repeatable); default: the repository of the current directory
  --input FILE        read PRs from a saved \`gh pr list --json\` output instead of calling gh (repeatable, pairs with --repo in order)
  --viewer LOGIN      GitHub login to highlight "awaiting you" and "yours"; default: gh api user
  --lang en|pt        language of the summary and the page (default: en)
  --limit N           max PRs per repository (default: 100)
  --author LOGIN      only PRs by this author (gh --author; @me works)
  --search QUERY      extra gh search filter, e.g. "label:backend"
  --no-drafts         leave draft PRs out
  --stale-days N      days without activity before a PR is flagged as stale (default: 7)
  --out DIR           where board.html and board.json are written (default: <tmp>/pr-review-board/<repo>)
  --open              serve the board on 127.0.0.1 and open its http:// URL in the default browser
  --json              print the board JSON instead of the Markdown summary
  --help              this text`;

const EXIT_OK = 0;
const EXIT_USAGE = 2;
const EXIT_GH = 3;

function parseArgs(argv) {
  const options = { repos: [], inputs: [], includeDrafts: true, lang: 'en', limit: 100, staleDays: 7, open: false, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`option ${arg} needs a value`);
      i += 1;
      return value;
    };
    switch (arg) {
      case '--repo': options.repos.push(next()); break;
      case '--input': options.inputs.push(next()); break;
      case '--viewer': options.viewer = next(); break;
      case '--lang': options.lang = next(); break;
      case '--limit': options.limit = Number(next()); break;
      case '--author': options.author = next(); break;
      case '--search': options.search = next(); break;
      case '--stale-days': options.staleDays = Number(next()); break;
      case '--out': options.out = next(); break;
      case '--no-drafts': options.includeDrafts = false; break;
      case '--open': options.open = true; break;
      case '--json': options.json = true; break;
      case '--help': case '-h': options.help = true; break;
      default: throw new Error(`unknown option "${arg}"`);
    }
  }
  if (!supportedLanguages().includes(options.lang)) throw new Error(`--lang must be one of ${supportedLanguages().join(', ')}`);
  if (!Number.isInteger(options.limit) || options.limit < 1) throw new Error('--limit must be a positive integer');
  if (!Number.isInteger(options.staleDays) || options.staleDays < 0) throw new Error('--stale-days must be a non-negative integer');
  return options;
}

function slug(text) {
  return text.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'board';
}

function openInBrowser(target) {
  const [command, args] =
    process.platform === 'darwin' ? ['open', [target]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', target]]
    : ['xdg-open', [target]];
  return new Promise((resolveOpen) => {
    let child;
    try {
      child = spawn(command, args, { stdio: 'ignore', detached: true });
    } catch {
      return resolveOpen(false);
    }
    child.on('error', () => resolveOpen(false));
    child.on('spawn', () => {
      child.unref();
      resolveOpen(true);
    });
  });
}

function loadFixture(file) {
  const parsed = JSON.parse(readFileSync(resolve(file), 'utf8'));
  if (!Array.isArray(parsed)) throw new Error(`${file} must hold the JSON array printed by gh pr list --json`);
  return parsed;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`error: ${error.message}\n\n${USAGE}`);
    return EXIT_USAGE;
  }
  if (options.help) {
    console.log(USAGE);
    return EXIT_OK;
  }

  const offline = options.inputs.length > 0;
  const warnings = [];
  let repos = [...options.repos];
  let viewer = options.viewer ?? null;
  const raw = [];

  if (offline) {
    options.inputs.forEach((file, index) => {
      const label = repos[index] || null;
      for (const pr of loadFixture(file)) raw.push({ ...pr, __repo: label });
    });
    if (!repos.length) repos = options.inputs.map((file) => file.replace(/^.*[\\/]/, ''));
  } else {
    if (!repos.length) {
      const detected = currentRepo();
      if (!detected) {
        console.error('error: no --repo given and the current directory is not a GitHub repository gh can see\n\n' + USAGE);
        return EXIT_USAGE;
      }
      repos = [detected];
    }
    if (viewer === null) {
      viewer = viewerLogin();
      if (!viewer) warnings.push('could not read the signed-in user from gh; "awaiting you" and "yours" are not marked');
    }
    try {
      for (const repo of repos) {
        for (const pr of fetchOpenPrs(repo, { limit: options.limit, author: options.author, search: options.search })) {
          raw.push({ ...pr, __repo: repo });
        }
      }
    } catch (error) {
      if (error instanceof GhError) {
        console.error(`error: ${error.message}${error.hint ? `\nhint: ${error.hint}` : ''}${error.cause ? `\n${error.cause}` : ''}`);
        return EXIT_GH;
      }
      throw error;
    }
  }

  const board = buildBoard(raw, { viewer, repos, staleDays: options.staleDays, includeDrafts: options.includeDrafts });
  board.source = offline ? { kind: 'fixture', files: options.inputs } : { kind: 'gh', limit: options.limit, author: options.author || null, search: options.search || null };
  if (!offline && raw.length >= options.limit * repos.length) {
    warnings.push(`the limit of ${options.limit} PRs per repository was reached; raise --limit to see all of them`);
  }
  board.warnings = warnings;

  const outDir = resolve(options.out || join(tmpdir(), 'pr-review-board', slug(repos.join('+'))));
  mkdirSync(outDir, { recursive: true });
  const htmlPath = join(outDir, BOARD_HTML_FILE);
  const jsonPath = join(outDir, BOARD_JSON_FILE);
  writeFileSync(jsonPath, `${JSON.stringify(board, null, 2)}\n`);
  writeFileSync(htmlPath, renderHtml(board, { lang: options.lang }));

  let url = null;
  if (options.open) {
    try {
      ({ url } = await serveBoard(outDir));
    } catch (error) {
      warnings.push(`could not serve the board on ${SERVER_HOST} (${error.message}); opening the file instead, which lands in whatever app owns .html files`);
    }
  }

  const paths = { html: htmlPath, json: jsonPath, url };
  if (options.json) {
    console.log(JSON.stringify({ ...board, paths }, null, 2));
  } else {
    console.log(renderMarkdown(board, { lang: options.lang, paths }));
  }
  for (const warning of warnings) console.error(`WARNING: ${warning}`);

  if (options.open) {
    const target = url ?? htmlPath;
    const opened = await openInBrowser(target);
    if (!opened) console.error(`WARNING: could not open a browser here; open ${target} by hand`);
  }
  return EXIT_OK;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`error: ${error.message}`);
    process.exit(1);
  },
);
