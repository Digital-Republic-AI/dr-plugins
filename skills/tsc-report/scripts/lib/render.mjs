import { MESSAGE_PREVIEW_LENGTH, TABLE_ROW_LIMIT, TOP_CODES_PER_FILE } from './constants.mjs';

function escapeCell(text) {
  return String(text).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function preview(message) {
  const clean = escapeCell(message);
  return clean.length > MESSAGE_PREVIEW_LENGTH ? `${clean.slice(0, MESSAGE_PREVIEW_LENGTH - 3)}...` : clean;
}

function table(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const divider = `|${headers.map(() => '---').join('|')}|`;
  return [head, divider, ...rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`)].join('\n');
}

function remainderNote(total, shown, noun) {
  return total > shown ? `\n_+${total - shown} ${noun} (full list in the JSON)_` : '';
}

export function renderCodesTable(byCode) {
  const shown = byCode.slice(0, TABLE_ROW_LIMIT);
  const rows = shown.map((group) => [group.code, group.count, group.fileCount, preview(group.sampleMessage)]);
  return table(['Code', 'Occurrences', 'Files', 'Sample message'], rows) + remainderNote(byCode.length, shown.length, 'codes');
}

export function renderFilesTable(byFile) {
  const shown = byFile.slice(0, TABLE_ROW_LIMIT);
  const rows = shown.map((group) => [
    group.file,
    group.count,
    group.codes.slice(0, TOP_CODES_PER_FILE).map(({ code, count }) => `${code} (${count})`).join(', '),
  ]);
  return table(['File', 'Errors', 'Main codes'], rows) + remainderNote(byFile.length, shown.length, 'files');
}

function describeVersion({ typescriptVersion, typescriptSource }) {
  if (!typescriptVersion) return 'unknown';
  return typescriptSource === 'global' ? `${typescriptVersion} (global, not pinned by the project)` : typescriptVersion;
}

export function renderSummary({ meta, byCode, byFile, paths }) {
  const { totals } = meta;
  const lines = [
    `## tsc report: ${meta.label ?? meta.command}`,
    '',
    `- Command: \`${meta.command}\` (cwd: ${meta.cwd})`,
    `- Stamp: ${meta.stamp}`,
    `- Exit code: ${meta.exitCode} | Duration: ${meta.durationMs} ms | TypeScript: ${describeVersion(meta)}`,
    `- Diagnostics: ${totals.diagnostics} (errors: ${totals.errors}, warnings: ${totals.warnings}) in ${totals.files} files, ${totals.distinctCodes} distinct codes, ${totals.globalDiagnostics} global`,
    `- tsc "Found N errors": ${meta.reportedTotal ?? 'not printed'}`,
  ];
  for (const warning of meta.warnings) lines.push(`- WARNING: ${warning}`);
  for (const note of meta.notes) lines.push(`- NOTE: ${note}`);
  lines.push('', '### Files written', `- ${paths.raw}`, `- ${paths.byCode}`, `- ${paths.byFile}`);
  if (totals.diagnostics > 0) {
    lines.push('', '### By error code', renderCodesTable(byCode), '', '### By file', renderFilesTable(byFile));
  }
  return lines.join('\n');
}
