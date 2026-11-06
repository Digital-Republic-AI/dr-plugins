#!/usr/bin/env node
// Runs the TypeScript type checker, persists its raw output and writes two
// grouped JSON reports (by error code and by file). Subcommands:
//   detect [--cwd DIR]
//   stamp
//   run    [--root DIR] [--cwd DIR] [--stamp STAMP] [--label NAME] [--out DIR] -- <command>
//   parse  --input FILE [--root DIR] [--stamp STAMP] [--label NAME] [--out DIR]
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  BY_CODE_FILE,
  BY_FILE_FILE,
  COMMAND_NOT_FOUND_EXIT,
  EXIT_FAILURE,
  EXIT_OK,
  EXIT_USAGE,
  JSON_INDENT,
  RAW_OUTPUT_FILE,
  REPORTS_DIR_NAME,
  REPORT_SCHEMA_VERSION,
  UNRESOLVED_IMPORT_CODES,
} from './lib/constants.mjs';
import { detectProject, detectTypescript } from './lib/detect.mjs';
import { computeTotals, groupByCode, groupByFile } from './lib/group.mjs';
import { parseTscOutput } from './lib/parse.mjs';
import { renderSummary } from './lib/render.mjs';

const USAGE = `usage:
  tsc-report.mjs detect [--cwd DIR]
  tsc-report.mjs stamp
  tsc-report.mjs run [--root DIR] [--cwd DIR] [--stamp STAMP] [--label NAME] [--out DIR] -- <command>
  tsc-report.mjs parse --input FILE [--root DIR] [--stamp STAMP] [--label NAME] [--out DIR]`;

function parseArgs(argv) {
  const [subcommand, ...rest] = argv;
  const options = {};
  const separator = rest.indexOf('--');
  const flags = separator === -1 ? rest : rest.slice(0, separator);
  const command = separator === -1 ? [] : rest.slice(separator + 1);
  for (let i = 0; i < flags.length; i += 2) {
    const key = flags[i];
    const value = flags[i + 1];
    if (!key.startsWith('--') || value === undefined) throw new Error(`invalid option near "${key}"`);
    options[key.slice(2)] = value;
  }
  return { subcommand, options, command: command.join(' ').trim() };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function localStamp(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function isoWithOffset(date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const local = new Date(date.getTime() + offsetMinutes * 60000).toISOString().slice(0, 19);
  return `${local}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function resolveOutDir(options, root) {
  if (options.out) return resolve(options.out);
  const base = join(root, REPORTS_DIR_NAME, options.stamp);
  return options.label ? join(base, options.label) : base;
}

function runCommand(command, cwd) {
  return new Promise((resolvePromise) => {
    const started = Date.now();
    const chunks = [];
    const child = spawn(command, {
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('error', (error) => {
      chunks.push(Buffer.from(`\n[tsc-report] failed to start command: ${error.message}\n`));
    });
    child.on('close', (code, signal) => {
      resolvePromise({
        output: Buffer.concat(chunks).toString('utf8'),
        exitCode: code ?? EXIT_FAILURE,
        signal,
        durationMs: Date.now() - started,
      });
    });
  });
}

function collectWarnings({ exitCode, signal, totals, reportedTotal }) {
  const warnings = [];
  if (signal) warnings.push(`command terminated by signal ${signal}`);
  if (exitCode === COMMAND_NOT_FOUND_EXIT) warnings.push('command not found (exit 127); check the command and whether TypeScript is installed');
  else if (exitCode !== null && exitCode !== EXIT_OK && totals.diagnostics === 0) {
    warnings.push('command failed without any TypeScript diagnostic; read the raw output (script error, missing dependency or a non-tsc tool)');
  }
  if (reportedTotal !== null && reportedTotal !== totals.errors) {
    warnings.push(`tsc reported ${reportedTotal} errors but ${totals.errors} were parsed; check the raw output for an unsupported format`);
  }
  return warnings;
}

function collectNotes(diagnostics) {
  const unresolved = diagnostics.filter((d) => UNRESOLVED_IMPORT_CODES.has(d.code)).length;
  if (unresolved === 0) return [];
  return [
    `${unresolved} unresolved import(s) (${[...UNRESOLVED_IMPORT_CODES].join('/')}): their types become any, so errors behind them are hidden and the total is a floor, not the real count`,
  ];
}

function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, JSON_INDENT)}\n`, 'utf8');
}

function buildReport({ rawOutput, run, root, outDir, label, command, cwd, now, options }) {
  const { diagnostics, reportedTotal } = parseTscOutput(rawOutput);
  const totals = computeTotals(diagnostics);
  const typescript = detectTypescript(cwd);
  const meta = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: isoWithOffset(now),
    label: label ?? null,
    command,
    cwd: relative(root, cwd) || '.',
    exitCode: run.exitCode,
    durationMs: run.durationMs,
    stamp: options.stamp,
    typescriptVersion: typescript.version,
    typescriptSource: typescript.source,
    rawOutputFile: RAW_OUTPUT_FILE,
    reportedTotal,
    totals,
    warnings: collectWarnings({ ...run, totals, reportedTotal }),
    notes: collectNotes(diagnostics),
  };
  const byCode = groupByCode(diagnostics);
  const byFile = groupByFile(diagnostics);
  mkdirSync(outDir, { recursive: true });
  const paths = {
    raw: join(outDir, RAW_OUTPUT_FILE),
    byCode: join(outDir, BY_CODE_FILE),
    byFile: join(outDir, BY_FILE_FILE),
  };
  writeFileSync(paths.raw, rawOutput, 'utf8');
  writeJson(paths.byCode, { meta, groups: byCode });
  writeJson(paths.byFile, { meta, groups: byFile });
  const relativePaths = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, relative(root, path)]));
  console.log(renderSummary({ meta, byCode, byFile, paths: relativePaths }));
  return meta.warnings.length > 0 && totals.diagnostics === 0 && run.exitCode !== EXIT_OK ? EXIT_FAILURE : EXIT_OK;
}

function withStamp(options, now) {
  return { ...options, stamp: options.stamp ?? localStamp(now) };
}

async function commandRun(options, command) {
  if (!command) throw new Error('run needs the command after "--"');
  const root = resolve(options.root ?? '.');
  const cwd = resolve(root, options.cwd ?? '.');
  const now = new Date();
  const stamped = withStamp(options, now);
  const run = await runCommand(command, cwd);
  return buildReport({ rawOutput: run.output, run, root, outDir: resolveOutDir(stamped, root), label: options.label, command, cwd, now, options: stamped });
}

function commandParse(options) {
  if (!options.input) throw new Error('parse needs --input FILE');
  const root = resolve(options.root ?? '.');
  const now = new Date();
  const rawOutput = readFileSync(resolve(options.input), 'utf8');
  const stamped = withStamp(options, now);
  const run = { exitCode: null, signal: null, durationMs: null };
  return buildReport({ rawOutput, run, root, outDir: resolveOutDir(stamped, root), label: options.label, command: `(parsed from ${options.input})`, cwd: root, now, options: stamped });
}

function commandDetect(options) {
  console.log(JSON.stringify(detectProject(resolve(options.cwd ?? '.')), null, JSON_INDENT));
  return EXIT_OK;
}

async function main() {
  const { subcommand, options, command } = parseArgs(process.argv.slice(2));
  if (subcommand === 'detect') return commandDetect(options);
  if (subcommand === 'stamp') {
    console.log(localStamp(new Date()));
    return EXIT_OK;
  }
  if (subcommand === 'run') return commandRun(options, command);
  if (subcommand === 'parse') return commandParse(options);
  console.error(USAGE);
  return EXIT_USAGE;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`[tsc-report] ${error.message}\n${USAGE}`);
    process.exit(EXIT_USAGE);
  });
