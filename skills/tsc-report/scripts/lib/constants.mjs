export const REPORT_SCHEMA_VERSION = 1;

export const REPORTS_DIR_NAME = 'tsc-reports';
export const RAW_OUTPUT_FILE = 'tsc-output.txt';
export const BY_CODE_FILE = 'errors-by-code.json';
export const BY_FILE_FILE = 'errors-by-file.json';

export const TABLE_ROW_LIMIT = 10;
export const MESSAGE_PREVIEW_LENGTH = 90;
export const TOP_CODES_PER_FILE = 3;
export const JSON_INDENT = 2;

export const DETECT_MAX_DEPTH = 4;
export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  REPORTS_DIR_NAME,
]);

export const TYPECHECK_SCRIPT_PATTERN = /\b(tsc|vue-tsc|svelte-check|tsgo)\b/;
export const TSCONFIG_FILE_PATTERN = /^tsconfig(\..+)?\.json$/;

export const LOCKFILES = [
  { file: 'pnpm-lock.yaml', manager: 'pnpm' },
  { file: 'yarn.lock', manager: 'yarn' },
  { file: 'bun.lockb', manager: 'bun' },
  { file: 'bun.lock', manager: 'bun' },
  { file: 'package-lock.json', manager: 'npm' },
];
export const DEFAULT_PACKAGE_MANAGER = 'npm';

export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;
export const COMMAND_NOT_FOUND_EXIT = 127;

export const GLOBAL_FILE_LABEL = '(global)';

// Imports that fail to resolve turn their types into any, hiding errors behind them.
export const UNRESOLVED_IMPORT_CODES = new Set(['TS2307', 'TS2792', 'TS7016']);

export const TSC_VERSION_COMMAND = 'tsc --version';
export const TSC_VERSION_PATTERN = /Version\s+(\d+\.\d+\.\d+\S*)/;
export const TSC_VERSION_TIMEOUT_MS = 15000;
