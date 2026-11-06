import { GLOBAL_FILE_LABEL } from './constants.mjs';

function countBy(items, keyOf) {
  const counts = new Map();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
}

function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function byCountDesc(a, b) {
  return b.count - a.count || String(a.sortKey).localeCompare(String(b.sortKey));
}

function fileLabel(diagnostic) {
  return diagnostic.file ?? GLOBAL_FILE_LABEL;
}

export function groupByCode(diagnostics) {
  const groups = [...groupBy(diagnostics, (d) => d.code).entries()].map(([code, items]) => ({
    sortKey: code,
    code,
    category: items[0].category,
    count: items.length,
    fileCount: new Set(items.filter((d) => d.file).map((d) => d.file)).size,
    sampleMessage: items[0].message,
    files: countBy(items, fileLabel).map(({ key, count }) => ({ file: key, count })),
    occurrences: items.map(({ file, line, column, category, message, details }) => ({
      file: file ?? GLOBAL_FILE_LABEL,
      line,
      column,
      category,
      message,
      details,
    })),
  }));
  return groups.sort(byCountDesc).map(({ sortKey, ...rest }) => rest);
}

export function groupByFile(diagnostics) {
  const groups = [...groupBy(diagnostics, fileLabel).entries()].map(([file, items]) => ({
    sortKey: file,
    file,
    count: items.length,
    codes: countBy(items, (d) => d.code).map(({ key, count }) => ({ code: key, count })),
    occurrences: items
      .map(({ line, column, code, category, message, details }) => ({ line, column, code, category, message, details }))
      .sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0)),
  }));
  return groups.sort(byCountDesc).map(({ sortKey, ...rest }) => rest);
}

export function computeTotals(diagnostics) {
  const countCategory = (category) => diagnostics.filter((d) => d.category === category).length;
  return {
    diagnostics: diagnostics.length,
    errors: countCategory('error'),
    warnings: countCategory('warning'),
    files: new Set(diagnostics.filter((d) => d.file).map((d) => d.file)).size,
    globalDiagnostics: diagnostics.filter((d) => !d.file).length,
    distinctCodes: new Set(diagnostics.map((d) => d.code)).size,
  };
}
