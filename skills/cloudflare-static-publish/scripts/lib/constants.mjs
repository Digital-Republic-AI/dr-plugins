export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;
export const JSON_INDENT = 2;

export const API_BASE_URL = 'https://api.cloudflare.com/client/v4';
export const ENV_API_TOKEN = 'CLOUDFLARE_API_TOKEN';
export const ENV_ACCOUNT_ID = 'CLOUDFLARE_ACCOUNT_ID';
export const LIST_PAGE_SIZE = 50;

export const PLATFORM_WORKERS = 'workers';
export const PLATFORM_PAGES = 'pages';
export const PLATFORMS = [PLATFORM_WORKERS, PLATFORM_PAGES];

export const NOT_FOUND_MODES = {
  spa: 'single-page-application',
  404: '404-page',
  none: null,
};

export const GIT_GITHUB_ACTIONS = 'github-actions';
export const GIT_NATIVE = 'native';
export const GIT_NONE = 'none';
export const GIT_MODES = [GIT_GITHUB_ACTIONS, GIT_NATIVE, GIT_NONE];

export const DEFAULT_BRANCH = 'main';
export const DEFAULT_SESSION_DURATION = '24h';
export const DEFAULT_PACKAGE_MANAGER = 'npm';

export const WRANGLER_PACKAGE = 'wrangler@4';
export const WRANGLER_CONFIG_PATH = 'wrangler.jsonc';
export const WRANGLER_CONFIG_FILES = ['wrangler.jsonc', 'wrangler.json', 'wrangler.toml'];
export const DEPLOY_SCRIPT_PATH = 'scripts/deploy-cloudflare.sh';
export const WORKFLOW_PATH = '.github/workflows/deploy-cloudflare.yml';
export const WORKFLOWS_DIR = '.github/workflows';
export const ASSETSIGNORE_FILE = '.assetsignore';
export const SCRIPT_FILE_MODE = 0o755;

export const ASSETSIGNORE_BASE = ['.DS_Store', 'node_modules', '.git'];
// When the project root itself is the assets directory, project files would be uploaded as public assets.
export const ASSETSIGNORE_ROOT_EXTRA = [
  '.github',
  '.wrangler',
  '.gitignore',
  '.assetsignore',
  'wrangler.jsonc',
  'wrangler.json',
  'wrangler.toml',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'scripts',
  'README.md',
];

export const GITHUB_ACTIONS = {
  checkout: 'actions/checkout@v4',
  setupNode: 'actions/setup-node@v4',
  setupPnpm: 'pnpm/action-setup@v4',
  setupBun: 'oven-sh/setup-bun@v2',
  wrangler: 'cloudflare/wrangler-action@v4',
};
export const CI_NODE_VERSION = '22';

export const LOCKFILES = [
  { file: 'pnpm-lock.yaml', manager: 'pnpm' },
  { file: 'yarn.lock', manager: 'yarn' },
  { file: 'bun.lockb', manager: 'bun' },
  { file: 'bun.lock', manager: 'bun' },
  { file: 'package-lock.json', manager: 'npm' },
];

export const INSTALL_COMMANDS = {
  npm: 'npm ci',
  pnpm: 'pnpm install --frozen-lockfile',
  yarn: 'yarn install --frozen-lockfile',
  bun: 'bun install --frozen-lockfile',
};

export const RUN_SCRIPT_PREFIX = {
  npm: 'npm run',
  pnpm: 'pnpm run',
  yarn: 'yarn',
  bun: 'bun run',
};

export const FRAMEWORKS = [
  { dependency: 'astro', name: 'Astro', outputDir: 'dist', notFound: '404' },
  { dependency: '@docusaurus/core', name: 'Docusaurus', outputDir: 'build', notFound: '404' },
  { dependency: '@11ty/eleventy', name: 'Eleventy', outputDir: '_site', notFound: '404' },
  { dependency: 'gatsby', name: 'Gatsby', outputDir: 'public', notFound: '404' },
  { dependency: 'vitepress', name: 'VitePress', outputDir: '.vitepress/dist', notFound: '404' },
  { dependency: 'next', name: 'Next.js (static export: output "export")', outputDir: 'out', notFound: '404' },
  { dependency: '@sveltejs/adapter-static', name: 'SvelteKit (adapter-static)', outputDir: 'build', notFound: 'spa' },
  { dependency: 'react-scripts', name: 'Create React App', outputDir: 'build', notFound: 'spa' },
  { dependency: '@angular/core', name: 'Angular', outputDir: 'dist', notFound: 'spa' },
  { dependency: 'vite', name: 'Vite', outputDir: 'dist', notFound: 'spa' },
];

export const OUTPUT_DIR_CANDIDATES = ['dist', 'build', 'out', '_site', 'public', 'site', 'docs', 'www', '.'];
export const WALK_IGNORED_DIRS = new Set(['node_modules', '.git', '.wrangler']);

export const FREE_PLAN_FILE_LIMIT = 20000;
export const PAID_PLAN_FILE_LIMIT = 100000;
export const BYTES_PER_MIB = 1024 * 1024;
export const MAX_ASSET_MIB = 25;
export const MAX_ASSET_BYTES = MAX_ASSET_MIB * BYTES_PER_MIB;
export const OVERSIZED_FILES_REPORTED = 10;

export const OTP_IDP_TYPE = 'onetimepin';
export const OTP_IDP_NAME = 'One-time PIN';
export const ACCESS_APP_TYPE = 'self_hosted';
export const ACCESS_POLICY_PRECEDENCE = 1;
export const PLACEHOLDER_IDP_ID = '<onetimepin-idp-id>';
export const PLACEHOLDER_POLICY_ID = '<policy-id>';
export const PLACEHOLDER_ZONE_ID = '<zone-id>';
export const ACCESS_LOGIN_HOST_SUFFIX = '.cloudflareaccess.com';
export const ACTIVE_ZONE_STATUS = 'active';
// Hostnames owned by Cloudflare, not zones of the account: Access can only be enabled on them from the dashboard.
export const DASHBOARD_ONLY_ACCESS_SUFFIXES = ['.pages.dev', '.workers.dev'];

export const DNS_RECORD_TYPE = 'CNAME';
export const DNS_TTL_AUTO = 1;
export const DNS_RECORD_COMMENT = 'Static site published with cloudflare-static-publish';
export const PAGES_DEV_SUFFIX = '.pages.dev';
export const WORKERS_DEV_SUFFIX = '.workers.dev';
// Second-level public suffixes common in this team's domains; used only to guess whether a hostname is an apex.
export const MULTI_LABEL_PUBLIC_SUFFIXES = ['com.br', 'net.br', 'org.br', 'gov.br', 'edu.br', 'app.br', 'co.uk', 'org.uk', 'com.au', 'com.mx', 'com.ar'];
export const APEX_LABEL_COUNT = 2;

export const HTTP_REDIRECT_MIN = 300;
export const HTTP_REDIRECT_MAX = 399;
export const HTTP_ERROR_MIN = 400;
export const VERIFY_TIMEOUT_MS = 15000;
export const GIT_TIMEOUT_MS = 5000;
