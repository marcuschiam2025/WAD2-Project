// What the student typed as their e$ balance, to 2 decimal places. Null when it isn't a number of 0 or more.
export function parseBalance(text) {
  const tidy = String(text ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(tidy)) return null;
  return Number(Number(tidy).toFixed(2));
}
