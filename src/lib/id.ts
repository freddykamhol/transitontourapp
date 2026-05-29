export function createId(prefix: string): string {
  const rand = Math.random().toString(16).slice(2, 10);
  const time = Date.now().toString(16);
  return `${prefix}-${time}-${rand}`;
}

