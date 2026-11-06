import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  DEFAULT_PACKAGE_MANAGER,
  ENV_ACCOUNT_ID,
  ENV_API_TOKEN,
  FRAMEWORKS,
  FREE_PLAN_FILE_LIMIT,
  GIT_TIMEOUT_MS,
  LOCKFILES,
  MAX_ASSET_BYTES,
  OUTPUT_DIR_CANDIDATES,
  OVERSIZED_FILES_REPORTED,
  PAID_PLAN_FILE_LIMIT,
  WALK_IGNORED_DIRS,
  WORKFLOWS_DIR,
  WRANGLER_CONFIG_FILES,
} from './constants.mjs';
import { parseJsonc } from './jsonc.mjs';

function readText(path) {
  try {
    return { text: readFileSync(path, 'utf8'), error: null };
  } catch (error) {
    return { text: null, error: error.message };
  }
}

function readJson(path, { jsonc = false } = {}) {
  const { text, error } = readText(path);
  if (error) return { value: null, error };
  try {
    return { value: jsonc ? parseJsonc(text) : JSON.parse(text), error: null };
  } catch (parseError) {
    return { value: null, error: parseError.message };
  }
}

export function detectPackageManager(cwd) {
  const hit = LOCKFILES.find(({ file }) => existsSync(join(cwd, file)));
  if (hit) return { manager: hit.manager, lockfile: hit.file };
  return { manager: existsSync(join(cwd, 'package.json')) ? DEFAULT_PACKAGE_MANAGER : null, lockfile: null };
}

function detectFramework(pkg) {
  const dependencies = { ...pkg?.dependencies, ...pkg?.devDependencies };
  return FRAMEWORKS.find((framework) => framework.dependency in dependencies) ?? null;
}

function walkFiles(root) {
  const stats = { fileCount: 0, largest: null, oversized: [], unreadable: [] };
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      stats.unreadable.push({ dir: relative(root, dir) || '.', error: error.message });
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!WALK_IGNORED_DIRS.has(entry.name)) stack.push(full);
      } else if (entry.isFile()) {
        recordFile(stats, root, full);
      }
    }
  }
  return stats;
}

function recordFile(stats, root, full) {
  const { size } = statSync(full);
  const path = relative(root, full);
  stats.fileCount += 1;
  if (!stats.largest || size > stats.largest.bytes) stats.largest = { path, bytes: size };
  if (size > MAX_ASSET_BYTES && stats.oversized.length < OVERSIZED_FILES_REPORTED) stats.oversized.push({ path, bytes: size });
}

function describeOutputDir(cwd, dir) {
  const full = join(cwd, dir);
  if (!existsSync(full) || !statSync(full).isDirectory()) return null;
  const hasIndexHtml = existsSync(join(full, 'index.html'));
  if (!hasIndexHtml) return null;
  const stats = walkFiles(full);
  return {
    dir,
    hasIndexHtml,
    has404Html: existsSync(join(full, '404.html')),
    hasHeadersFile: existsSync(join(full, '_headers')),
    hasRedirectsFile: existsSync(join(full, '_redirects')),
    fileCount: stats.fileCount,
    largestFile: stats.largest,
    oversizedFiles: stats.oversized,
    exceedsFreePlanFileLimit: stats.fileCount > FREE_PLAN_FILE_LIMIT,
    exceedsPaidPlanFileLimit: stats.fileCount > PAID_PLAN_FILE_LIMIT,
    unreadableDirs: stats.unreadable,
  };
}

function describeWranglerConfig(cwd, file) {
  const path = join(cwd, file);
  if (file.endsWith('.toml')) return { file, format: 'toml', parsed: null, parseError: null };
  const { value, error } = readJson(path, { jsonc: true });
  return {
    file,
    format: file.endsWith('.jsonc') ? 'jsonc' : 'json',
    parsed: value && {
      name: value.name ?? null,
      main: value.main ?? null,
      assetsDirectory: value.assets?.directory ?? null,
      pagesBuildOutputDir: value.pages_build_output_dir ?? null,
      routes: value.routes ?? null,
      workersDev: value.workers_dev ?? null,
    },
    parseError: error,
  };
}

function providerOf(remote) {
  if (/github\.com[:/]/.test(remote)) return 'github';
  if (/gitlab\.com[:/]/.test(remote)) return 'gitlab';
  if (/bitbucket\.org[:/]/.test(remote)) return 'bitbucket';
  return 'other';
}

function runGit(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function tryGit(cwd, args) {
  try {
    return { value: runGit(cwd, args), error: null };
  } catch (error) {
    return { value: null, error: error.message.split('\n')[0] };
  }
}

function detectGit(cwd) {
  const remote = tryGit(cwd, ['remote', 'get-url', 'origin']);
  const branch = tryGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return {
    remote: remote.value,
    provider: remote.value ? providerOf(remote.value) : null,
    branch: branch.value,
    error: remote.error ?? branch.error,
  };
}

function detectWorkflows(cwd) {
  const dir = join(cwd, WORKFLOWS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => /\.ya?ml$/.test(file))
    .map((file) => {
      const { text } = readText(join(dir, file));
      return { file: join(WORKFLOWS_DIR, file), mentionsWrangler: Boolean(text && /wrangler/.test(text)) };
    });
}

export function detectProject(cwd) {
  const pkgPath = join(cwd, 'package.json');
  const pkg = existsSync(pkgPath) ? readJson(pkgPath) : { value: null, error: null };
  const framework = detectFramework(pkg.value);
  const outputDirs = OUTPUT_DIR_CANDIDATES.map((dir) => describeOutputDir(cwd, dir)).filter(Boolean);
  return {
    cwd,
    packageJson: { present: Boolean(pkg.value), error: pkg.error, buildScript: pkg.value?.scripts?.build ?? null },
    packageManager: detectPackageManager(cwd),
    framework: framework && { name: framework.name, expectedOutputDir: framework.outputDir, suggestedNotFound: framework.notFound },
    outputDirs,
    wranglerConfigs: WRANGLER_CONFIG_FILES.filter((file) => existsSync(join(cwd, file))).map((file) => describeWranglerConfig(cwd, file)),
    wranglerInstalledLocally: existsSync(join(cwd, 'node_modules', '.bin', 'wrangler')),
    git: detectGit(cwd),
    workflows: detectWorkflows(cwd),
    credentials: {
      apiTokenSet: Boolean(process.env[ENV_API_TOKEN]),
      accountIdSet: Boolean(process.env[ENV_ACCOUNT_ID]),
    },
    limits: { freePlanFiles: FREE_PLAN_FILE_LIMIT, paidPlanFiles: PAID_PLAN_FILE_LIMIT, maxFileBytes: MAX_ASSET_BYTES },
  };
}
