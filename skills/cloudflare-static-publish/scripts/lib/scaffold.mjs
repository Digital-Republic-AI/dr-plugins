import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import {
  ASSETSIGNORE_FILE,
  DEPLOY_SCRIPT_PATH,
  GIT_GITHUB_ACTIONS,
  PLATFORM_WORKERS,
  SCRIPT_FILE_MODE,
  WORKFLOW_PATH,
  WRANGLER_CONFIG_FILES,
  WRANGLER_CONFIG_PATH,
} from './constants.mjs';
import { renderAssetsIgnore, renderDeployScript, renderGithubWorkflow, renderWranglerConfig } from './templates.mjs';

function isProjectRoot(dir) {
  return normalize(dir) === '.';
}

function planWranglerConfig(cwd, site) {
  const existing = WRANGLER_CONFIG_FILES.filter((file) => existsSync(join(cwd, file)));
  const conflicting = existing.filter((file) => file !== WRANGLER_CONFIG_PATH);
  if (conflicting.length > 0 && !site.force) {
    return {
      path: WRANGLER_CONFIG_PATH,
      content: renderWranglerConfig(site),
      blockedBy: `existing ${conflicting.join(', ')}: merge the generated settings into it instead of adding a second config`,
    };
  }
  return { path: WRANGLER_CONFIG_PATH, content: renderWranglerConfig(site) };
}

function planAssetsIgnore(site) {
  // Only a source directory keeps the file: a build output directory is recreated on every build.
  if (site.platform !== PLATFORM_WORKERS || site.build) return null;
  return { path: join(site.dir, ASSETSIGNORE_FILE), content: renderAssetsIgnore(isProjectRoot(site.dir)) };
}

export function planFiles(cwd, site) {
  const files = [planWranglerConfig(cwd, site)];
  const assetsIgnore = planAssetsIgnore(site);
  if (assetsIgnore) files.push(assetsIgnore);
  if (site.manualScript) files.push({ path: DEPLOY_SCRIPT_PATH, content: renderDeployScript(site), executable: true });
  if (site.git === GIT_GITHUB_ACTIONS) files.push({ path: WORKFLOW_PATH, content: renderGithubWorkflow(site) });
  return files;
}

function writePlannedFile(cwd, file, force) {
  const full = join(cwd, file.path);
  if (file.blockedBy) return { path: file.path, status: 'skipped', reason: file.blockedBy, content: file.content };
  if (existsSync(full) && !force) return { path: file.path, status: 'skipped', reason: 'file exists (pass --force to overwrite)', content: file.content };
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, file.content);
  if (file.executable) chmodSync(full, SCRIPT_FILE_MODE);
  return { path: file.path, status: 'written' };
}

export function scaffold(cwd, site, { dryRun }) {
  const files = planFiles(cwd, site);
  if (dryRun) return files.map((file) => ({ path: file.path, status: 'planned', blockedBy: file.blockedBy ?? null, content: file.content }));
  return files.map((file) => writePlannedFile(cwd, file, site.force));
}
