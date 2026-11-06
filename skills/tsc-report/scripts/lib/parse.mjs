const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;
const PLAIN_DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): (error|warning|message) (TS\d+): (.*)$/;
const PRETTY_DIAGNOSTIC = /^(.+?):(\d+):(\d+) - (error|warning|message) (TS\d+): (.*)$/;
const GLOBAL_DIAGNOSTIC = /^(error|warning|message) (TS\d+): (.*)$/;
const FOUND_SUMMARY = /^Found (\d+) errors?\b/;
const CONTINUATION = /^\s+\S/;

function normalizePath(file) {
  return file.trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function fileDiagnostic(match, format) {
  const [, file, line, column, category, code, message] = match;
  return {
    file: normalizePath(file),
    line: Number(line),
    column: Number(column),
    category,
    code,
    message: message.trim(),
    details: [],
    format,
  };
}

function globalDiagnostic(match) {
  const [, category, code, message] = match;
  return { file: null, line: null, column: null, category, code, message: message.trim(), details: [], format: 'plain' };
}

function matchHeader(line) {
  const plain = line.match(PLAIN_DIAGNOSTIC);
  if (plain) return fileDiagnostic(plain, 'plain');
  const pretty = line.match(PRETTY_DIAGNOSTIC);
  if (pretty) return fileDiagnostic(pretty, 'pretty');
  const global = line.match(GLOBAL_DIAGNOSTIC);
  return global ? globalDiagnostic(global) : null;
}

// In plain mode, indented lines after a diagnostic are its message chain;
// in pretty mode they are code frames and are ignored.
function appendContinuation(current, line) {
  if (current && current.format === 'plain' && CONTINUATION.test(line)) {
    current.details.push(line.trim());
  }
}

export function parseTscOutput(rawText) {
  const lines = rawText.replace(ANSI_PATTERN, '').split(/\r?\n/);
  const diagnostics = [];
  let reportedTotal = null;
  let current = null;

  for (const line of lines) {
    const header = matchHeader(line);
    if (header) {
      current = header;
      diagnostics.push(header);
      continue;
    }
    const found = line.match(FOUND_SUMMARY);
    if (found) {
      reportedTotal = Number(found[1]);
      current = null;
      continue;
    }
    appendContinuation(current, line);
  }

  return {
    diagnostics: diagnostics.map(({ format, ...rest }) => rest),
    reportedTotal,
  };
}
