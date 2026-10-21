// Reference bid: rate a bid against the historical median ± 1 SD. Pure function — unit test me.
import { MIN_BID } from '../models/BidCart.js'

/**
 * @param {Array<{ median: number }>} history bid results to compare against (e.g. last 3 terms, one round)
 * @param {number} [amount] the student's bid; omit to only get the suggestion
 */
export function referenceBid(history, amount) {
  if (!history.length) return { rating: null, suggested: MIN_BID, mean: null, sd: null }

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

  const suggested = Math.max(MIN_BID, Math.ceil(mean + sd))

  let rating = null
  if (amount !== undefined) {
    if (amount >= mean + sd) rating = 'safe'
    else if (amount >= mean - sd) rating = 'competitive'
    else rating = 'at-risk'
  }

  return { rating, suggested, mean: +mean.toFixed(2), sd: +sd.toFixed(2), basedOn: history.length }
}
