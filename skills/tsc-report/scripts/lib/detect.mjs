import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import {
  DEFAULT_PACKAGE_MANAGER,
  DETECT_MAX_DEPTH,
  IGNORED_DIRS,
  LOCKFILES,
  TSC_VERSION_COMMAND,
  TSC_VERSION_PATTERN,
  TSC_VERSION_TIMEOUT_MS,
  TSCONFIG_FILE_PATTERN,
  TYPECHECK_SCRIPT_PATTERN,
} from './constants.mjs';

// tsconfig files are JSONC: drop comments and trailing commas outside strings.
function parseJsonc(text) {
  let output = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (inString) {
      output += char;
      if (char === '\\') {
        output += next ?? '';
        i += 1;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
      output += char;
    } else if (char === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      output += '\n';
    } else if (char === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 1;
    } else {
      output += char;
    }
  }
  return JSON.parse(output.replace(/,(\s*[}\]])/g, '$1'));
}

function readJson(path, { jsonc = false } = {}) {
  try {
    const text = readFileSync(path, 'utf8');
    return { value: jsonc ? parseJsonc(text) : JSON.parse(text), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

function findUp(startDir, predicate) {
  let dir = startDir;
  while (true) {
    const found = predicate(dir);
    if (found) return found;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function detectPackageManager(cwd) {
  const hit = findUp(cwd, (dir) => LOCKFILES.find(({ file }) => existsSync(join(dir, file))));
  return hit ? hit.manager : DEFAULT_PACKAGE_MANAGER;
}

function globalTscVersion(cwd) {
  try {
    const output = execSync(TSC_VERSION_COMMAND, { cwd, encoding: 'utf8', timeout: TSC_VERSION_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'] });
    return { version: output.match(TSC_VERSION_PATTERN)?.[1] ?? null, error: null };
  } catch (error) {
    return { version: null, error: `"${TSC_VERSION_COMMAND}" failed: ${error.message.split('\n')[0]}` };
  }
}

export function detectTypescript(cwd) {
  const pkgPath = findUp(cwd, (dir) => {
    const candidate = join(dir, 'node_modules', 'typescript', 'package.json');
    return existsSync(candidate) ? candidate : null;
  });
  if (pkgPath) {
    return {
      installed: true,
      source: 'local',
      version: readJson(pkgPath).value?.version ?? null,
      location: relative(cwd, dirname(pkgPath)) || '.',
      error: null,
    };
  }
  const global = globalTscVersion(cwd);
  return {
    installed: false,
    source: global.version ? 'global' : null,
    version: global.version,
    location: null,
    error: global.error,
  };
}

function walkTsconfigs(root, dir, depth, found) {
  if (depth > DETECT_MAX_DEPTH) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    found.unreadable.push({ dir: relative(root, dir) || '.', error: error.message });
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
      walkTsconfigs(root, full, depth + 1, found);
    } else if (entry.isFile() && TSCONFIG_FILE_PATTERN.test(entry.name)) {
      found.files.push(full);
    }
  }
}

function describeTsconfig(root, path) {
  const { value, error } = readJson(path, { jsonc: true });
  const references = Array.isArray(value?.references) ? value.references.map((ref) => ref.path) : [];
  const files = Array.isArray(value?.files) ? value.files : null;
  return {
    path: relative(root, path),
    extends: value?.extends ?? null,
    references,
    solutionStyle: references.length > 0 && files !== null && files.length === 0 && !value?.include,
    noEmit: value?.compilerOptions?.noEmit ?? null,
    strict: value?.compilerOptions?.strict ?? null,
    parseError: error,
  };
}

function detectScripts(pkg) {
  return Object.entries(pkg?.scripts ?? {})
    .filter(([, command]) => TYPECHECK_SCRIPT_PATTERN.test(command))
    .map(([name, command]) => ({ name, command }));
}

function workspacesOf(pkg) {
  const workspaces = pkg?.workspaces;
  if (Array.isArray(workspaces)) return workspaces;
  return Array.isArray(workspaces?.packages) ? workspaces.packages : [];
}

function runScriptCommand(manager, script) {
  return manager === 'npm' ? `npm run ${script}` : `${manager} run ${script}`;
}

function suggestCommands({ manager, scripts, tsconfigs, typescript }) {
  const suggestions = scripts.map((script) => ({
    command: runScriptCommand(manager, script.name),
    reason: `package.json script "${script.name}": ${script.command}`,
  }));
  const tscBinary = typescript.installed ? 'npx tsc' : 'npx -p typescript tsc';
  for (const config of tsconfigs) {
    if (config.solutionStyle) {
      suggestions.push({ command: `${tscBinary} -b ${config.path}`, reason: `solution-style tsconfig with references: ${config.references.join(', ')}` });
    } else {
      suggestions.push({ command: `${tscBinary} --noEmit -p ${config.path}`, reason: `tsconfig ${config.path}` });
    }
  }
  return suggestions;
}

export function detectProject(cwd) {
  const pkgResult = existsSync(join(cwd, 'package.json')) ? readJson(join(cwd, 'package.json')) : { value: null, error: null };
  const found = { files: [], unreadable: [] };
  walkTsconfigs(cwd, cwd, 0, found);
  const tsconfigs = found.files.sort().map((path) => describeTsconfig(cwd, path));
  const manager = detectPackageManager(cwd);
  const scripts = detectScripts(pkgResult.value);
  const typescript = detectTypescript(cwd);
  const workspaceFile = join(cwd, 'pnpm-workspace.yaml');
  return {
    cwd,
    packageManager: manager,
    packageJsonError: pkgResult.error,
    typescript,
    typecheckScripts: scripts,
    workspaces: workspacesOf(pkgResult.value),
    pnpmWorkspace: existsSync(workspaceFile),
    tsconfigs,
    unreadableDirs: found.unreadable,
    multipleTargets: tsconfigs.length > 1 || workspacesOf(pkgResult.value).length > 0 || existsSync(workspaceFile),
    suggestions: suggestCommands({ manager, scripts, tsconfigs, typescript }),
  };
}
