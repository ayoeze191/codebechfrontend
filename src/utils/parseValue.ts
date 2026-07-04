export function parseValue(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
