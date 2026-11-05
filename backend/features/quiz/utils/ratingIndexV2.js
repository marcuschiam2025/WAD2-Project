const ratingValues = new Map([
  [1, 0],
  [2, 25],
  [4, 75],
  [5, 100],
]);

/**
 * Summarise one theme's ratings using section weights. Inputs are numeric
 * ratings (not option ID strings); callers must map validated responses first.
 * Unsure and Skip supply no evidence. Keep precision until display time.
 */
export function calculateThemeRating(ratings) {
  if (!Array.isArray(ratings)) throw new TypeError('ratings must be an array');

  let weightedTotal = 0;
  let observedWeight = 0;
  let informativeCount = 0;

  for (const rating of ratings) {
    if (!rating || typeof rating !== 'object') throw new TypeError('Invalid rating entry');
    const { value, weight } = rating;
    if (value !== null && ![1, 2, 3, 4, 5].includes(value)) {
      throw new TypeError('Rating must be an integer from 1 to 5, or null');
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new TypeError('Rating weight must be a positive finite number');
    }
    if (value === null || value === 3) continue;

    weightedTotal += ratingValues.get(value) * weight;
    observedWeight += weight;
    informativeCount += 1;
  }

  return {
    index: informativeCount === 0 ? null : weightedTotal / observedWeight,
    informativeCount,
  };
}
