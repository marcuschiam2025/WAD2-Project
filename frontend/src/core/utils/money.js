// Sum and compare budgets in whole cents; keep API bid amounts in e$.
export const toCents = (n) => Math.round(Number(n) * 100);

// e$ amounts for display: never show more than 2 decimals.
export const fmtE = (n) => {
  const value = Math.round((Number(n) || 0) * 100) / 100;
  // 40 stays 40, but 151.1 reads 151.10, so an amount looks the same on every screen
  return value.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
};
