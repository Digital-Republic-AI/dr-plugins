import {
  ASSETSIGNORE_BASE,
  ASSETSIGNORE_ROOT_EXTRA,
  CI_NODE_VERSION,
  ENV_ACCOUNT_ID,
  ENV_API_TOKEN,
  GITHUB_ACTIONS,
  INSTALL_COMMANDS,
  JSON_INDENT,
  NOT_FOUND_MODES,
  PLATFORM_PAGES,
  RUN_SCRIPT_PREFIX,
  WRANGLER_PACKAGE,
} from './constants.mjs';

const WORKERS_DOCS = 'https://developers.cloudflare.com/workers/static-assets/';
const PAGES_DOCS = 'https://developers.cloudflare.com/pages/functions/wrangler-configuration/';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function workersConfig(site) {
  const config = { name: site.name, compatibility_date: today(), assets: { directory: site.dir } };
  const notFound = NOT_FOUND_MODES[site.notFound];
  if (notFound) config.assets.not_found_handling = notFound;
  if (site.domains.length > 0) {
    config.routes = site.domains.map((pattern) => ({ pattern, custom_domain: true }));
  }
  // A protected site must not stay reachable on *.workers.dev or on preview URLs, which the custom-domain Access app does not cover.
  if (site.domains.length > 0 || site.protect) config.workers_dev = false;
  if (site.protect) config.preview_urls = false;
  return config;
}

function pagesConfig(site) {
  return { name: site.name, compatibility_date: today(), pages_build_output_dir: site.dir };
}

export function renderWranglerConfig(site) {
  const isPages = site.platform === PLATFORM_PAGES;
  const config = isPages ? pagesConfig(site) : workersConfig(site);
  const header = isPages
    ? `// Cloudflare Pages project configuration: ${PAGES_DOCS}`
    : `// Cloudflare Workers Static Assets (no Worker script): ${WORKERS_DOCS}`;
  return `${header}\n${JSON.stringify(config, null, JSON_INDENT)}\n`;
}

export function renderAssetsIgnore(isProjectRoot) {
  const entries = isProjectRoot ? [...ASSETSIGNORE_BASE, ...ASSETSIGNORE_ROOT_EXTRA] : ASSETSIGNORE_BASE;
  return `# Files in the assets directory that must not be uploaded (.gitignore syntax)\n${entries.join('\n')}\n`;
}

export function buildCommand(site) {
  return site.build ? `${RUN_SCRIPT_PREFIX[site.packageManager]} ${site.build}` : null;
}

function deployCommandLine(site) {
  if (site.platform === PLATFORM_PAGES) {
    return `npx --yes ${WRANGLER_PACKAGE} pages deploy "${site.dir}" --project-name="${site.name}" --branch="$BRANCH"`;
  }
  return `npx --yes ${WRANGLER_PACKAGE} deploy`;
}

export function renderDeployScript(site) {
  const build = buildCommand(site);
  const lines = [
    '#!/usr/bin/env bash',
    `# Manual deploy of the static site "${site.name}" to Cloudflare ${site.platform === PLATFORM_PAGES ? 'Pages' : 'Workers'}.`,
    `# Authentication: export ${ENV_API_TOKEN} and ${ENV_ACCOUNT_ID}, or run "npx ${WRANGLER_PACKAGE} login" once.`,
    site.platform === PLATFORM_PAGES ? `# Usage: ${'$'}0 [branch]   (default "${site.branch}" = production; any other branch is a preview)` : `# Usage: ${'$'}0`,
    'set -euo pipefail',
    '',
    'cd "$(dirname "$0")/.."',
  ];
  if (site.platform === PLATFORM_PAGES) lines.push(`BRANCH="\${1:-${site.branch}}"`);
  lines.push(
    '',
    `if [ -z "\${${ENV_API_TOKEN}:-}" ] && ! npx --yes ${WRANGLER_PACKAGE} whoami --json >/dev/null 2>&1; then`,
    `  echo "Not authenticated with Cloudflare: export ${ENV_API_TOKEN} and ${ENV_ACCOUNT_ID}, or run: npx ${WRANGLER_PACKAGE} login" >&2`,
    '  exit 1',
    'fi',
    '',
  );
  if (build) lines.push(build, '');
  lines.push(
    `if [ ! -f "${site.dir}/index.html" ]; then`,
    `  echo "${site.dir}/index.html not found: check the build output directory" >&2`,
    '  exit 1',
    'fi',
    '',
    deployCommandLine(site),
    '',
  );
  return lines.join('\n');
}

function toolchainSteps(site) {
  if (!site.build) return [];
  const steps = [];
  if (site.packageManager === 'pnpm') steps.push(`      - uses: ${GITHUB_ACTIONS.setupPnpm}`);
  if (site.packageManager === 'bun') {
    steps.push(`      - uses: ${GITHUB_ACTIONS.setupBun}`);
  } else {
    steps.push(`      - uses: ${GITHUB_ACTIONS.setupNode}`, '        with:', `          node-version: ${CI_NODE_VERSION}`, `          cache: ${site.packageManager}`);
  }
  steps.push(`      - run: ${INSTALL_COMMANDS[site.packageManager]}`, `      - run: ${buildCommand(site)}`);
  return steps;
}

function workflowTrigger(site) {
  if (site.platform === PLATFORM_PAGES) {
    return ['on:', '  push:', '  workflow_dispatch:'];
  }
  return ['on:', '  push:', `    branches: [${site.branch}]`, '  workflow_dispatch:'];
}

function wranglerStep(site) {
  const step = [
    '      - name: Deploy to Cloudflare',
    `        uses: ${GITHUB_ACTIONS.wrangler}`,
    '        with:',
    `          apiToken: \${{ secrets.${ENV_API_TOKEN} }}`,
    `          accountId: \${{ secrets.${ENV_ACCOUNT_ID} }}`,
  ];
  if (site.platform === PLATFORM_PAGES) {
    step.push(
      `          command: pages deploy ${site.dir} --project-name=${site.name} --branch=\${{ github.ref_name }}`,
      '          gitHubToken: ${{ secrets.GITHUB_TOKEN }}',
    );
  } else {
    step.push('          command: deploy');
  }
  return step;
}

export function renderGithubWorkflow(site) {
  const isPages = site.platform === PLATFORM_PAGES;
  const permissions = isPages ? ['      contents: read', '      deployments: write'] : ['      contents: read'];
  const comment = isPages
    ? `# Pushes to "${site.branch}" publish production; pushes to any other branch publish a preview at <branch>.${site.name}.pages.dev.`
    : `# Pushes to "${site.branch}" publish production.`;
  return [
    `name: Deploy ${site.name} to Cloudflare ${isPages ? 'Pages' : 'Workers'}`,
    comment,
    `# Repository secrets required: ${ENV_API_TOKEN}, ${ENV_ACCOUNT_ID}.`,
    '',
    ...workflowTrigger(site),
    '',
    'concurrency:',
    '  group: cloudflare-deploy-${{ github.ref }}',
    '  cancel-in-progress: false',
    '',
    'jobs:',
    '  deploy:',
    '    runs-on: ubuntu-latest',
    '    permissions:',
    ...permissions,
    '    steps:',
    `      - uses: ${GITHUB_ACTIONS.checkout}`,
    ...toolchainSteps(site),
    ...wranglerStep(site),
    '',
  ].join('\n');
}
