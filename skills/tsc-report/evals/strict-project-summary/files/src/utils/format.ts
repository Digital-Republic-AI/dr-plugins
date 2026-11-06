export function formatPrice(value, currency) {
  return `${currency} ${value.toFixed(2)}`;
}

export function pad(text, size) {
  return String(text).padStart(size, '0');
}

export function joinLines(lines) {
  return lines.join('\n');
}
