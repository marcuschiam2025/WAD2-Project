import { httpError } from '../../../middleware/errorHandler.js';
export function validateCartItems(items, balance) {
  if (!Array.isArray(items)) throw httpError(400, 'items must be an array');
  const seen = new Set();
  let totalCents = 0;
  for (const item of items) {
    if (
      !item ||
      typeof item.module !== 'string' ||
      !item.module ||
      typeof item.sectionId !== 'string' ||
      !item.sectionId
    )
      throw httpError(400, 'Each bid needs a module and section');
    if (seen.has(item.module)) throw httpError(400, 'Each module can only be in the cart once');
    seen.add(item.module);
    if (typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount < 10)
      throw httpError(400, 'Every bid must be a finite number of at least e$ 10');
    if (!/^\d+(?:\.\d{1,2})?$/.test(String(item.amount)))
      throw httpError(400, 'Every bid must have at most 2 decimal places');
    totalCents += Math.round(item.amount * 100);
  }
  if (totalCents > Math.round(balance * 100))
    throw httpError(400, `e$ ${totalCents / 100} is more than your balance of e$ ${balance}`);
  return totalCents / 100;
}
