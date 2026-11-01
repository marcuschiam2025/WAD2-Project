// e$ amounts for display: float sums like 166.73000000000002 are shown as 166.73, and never with more than 2 decimals.
export const fmtE = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })
