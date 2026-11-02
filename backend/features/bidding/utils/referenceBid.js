// Reference bid: rate a bid against past bid results. Pure function — unit test me.
import { MIN_BID } from '../models/BidCart.js'

/**
 * With 2+ terms: the mean of the past medians ± 1 SD.
 * With 1 term there is no spread to measure, so that term's own min and median are the band instead.
 * Below low = at risk, low to high = competitive, high and above = safe.
 * @param {Array<{ median: number, min?: number }>} history bid results to compare against (e.g. last 3 terms, one round)
 * @param {number} [amount] the student's bid; omit to only get the suggestion
 */
export function referenceBid(history, amount) {
  if (!history.length) return { rating: null, suggested: MIN_BID, mean: null, sd: null, low: null, high: null, basedOn: 0 }

  // Average of the past medians
  let total = 0
  for (const entry of history) {
    total += entry.median
  }
  const mean = total / history.length

  // Standard deviation: how far the medians spread out from the average
  let squaredGaps = 0
  for (const entry of history) {
    squaredGaps += (entry.median - mean) ** 2
  }
  const sd = Math.sqrt(squaredGaps / history.length)

  let low = mean - sd
  let high = mean + sd
  if (history.length === 1 && history[0].min !== undefined) {
    low = Math.min(history[0].min, history[0].median)
    high = history[0].median
  }

  const suggested = Math.max(MIN_BID, Math.ceil(high))

  let rating = null
  if (amount !== undefined) {
    if (amount >= high) rating = 'safe'
    else if (amount >= low) rating = 'competitive'
    else rating = 'at-risk'
  }

  return {
    rating,
    suggested,
    mean: +mean.toFixed(2),
    sd: +sd.toFixed(2),
    low: +low.toFixed(2),
    high: +high.toFixed(2),
    basedOn: history.length,
  }
}
