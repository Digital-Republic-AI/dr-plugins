const REPEATABLE_FLAGS = new Set(['hostname', 'email', 'email-domain', 'domain', 'url']);
const BOOLEAN_FLAGS = new Set(['apply', 'force', 'protect', 'external', 'expect-access', 'dry-run']);

export class UsageError extends Error {}

function readValue(rest, index, key) {
  const value = rest[index + 1];
  if (value === undefined || value.startsWith('--')) throw new UsageError(`missing value for --${key}`);
  return value;
}

export function parseArgs(argv) {
  const [subcommand, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) throw new UsageError(`unexpected argument: ${token}`);
    const key = token.slice(2);
    if (BOOLEAN_FLAGS.has(key)) {
      options[key] = true;
      continue;
    }
    const value = readValue(rest, i, key);
    i += 1;
    if (REPEATABLE_FLAGS.has(key)) {
      options[key] = [...(options[key] ?? []), value];
    } else {
      options[key] = value;
    }
  }
  return { subcommand, options };
}

export function requireOption(options, key) {
  const value = options[key];
  if (value === undefined || (Array.isArray(value) && value.length === 0)) {
    throw new UsageError(`--${key} is required`);
  }
  return value;
}

export function requireChoice(value, choices, key) {
  if (!choices.includes(value)) throw new UsageError(`--${key} must be one of: ${choices.join(', ')} (got "${value}")`);
  return value;
}

export function parseBoolean(value, key, fallback) {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new UsageError(`--${key} must be true or false (got "${value}")`);
}
