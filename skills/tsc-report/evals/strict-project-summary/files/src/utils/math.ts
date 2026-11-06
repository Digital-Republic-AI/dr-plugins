export function sum(values) {
  return values.reduce((acc, v) => acc + v, 0);
}

export function percent(part, whole) {
  return (part / whole) * 100;
}
