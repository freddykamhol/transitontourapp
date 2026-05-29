export function createId(prefix) {
  const rand = Math.random().toString(16).slice(2, 10);
  const time = Date.now().toString(16);
  return `${prefix}_${time}_${rand}`;
}

export function createToken() {
  return createId("tok");
}

