// BOSS timetable constants and bid-rating helpers. sections, bidHistory and weightage start empty: the bidding
// store fills them from GET /api/bidding/... for each module it loads.
import { reactive } from 'vue'

export const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const slots = [
  { start: '08:15', end: '11:30' },
  { start: '12:00', end: '15:15' },
  { start: '15:30', end: '18:45' },
  { start: '19:00', end: '22:15' },
]

export const sections = reactive([])

// module code -> past bid results [{ term, round, median, min }]
export const bidHistory = reactive({})

// module code -> grade weightage [{ label, pct }]
export const weightage = reactive({})

export const MIN_BID = 10

function termOrder(value) {
  const match = /^(?:AY(\d{2})\/(\d{2}) T|((?:20)\d{2})-(\d{2})_T)([1-3])$/.exec(value ?? '')
  if (!match) return null
  const year = match[3] ? Number(match[3]) : 2000 + Number(match[1])
  if (Number(match[4] ?? match[2]) !== (year + 1) % 100) return null
  return year * 10 + Number(match[5])
}

// Match the reference API: one round, at most three distinct terms before the target.
export const canEstimateBid = (round, term) => !!round && round !== 'all' && termOrder(term) !== null

export function estimateHistory(history, round, term) {
  const target = termOrder(term)
  if (!canEstimateBid(round, term)) return []
  const seen = new Set()
  return history.filter(h => h.round === round && Number.isFinite(h.median) && h.median >= 0 && termOrder(h.term) !== null && termOrder(h.term) < target)
    .sort((a, b) => termOrder(b.term) - termOrder(a.term))
    .filter(h => { const key = termOrder(h.term); if (seen.has(key)) return false; seen.add(key); return true })
    .slice(0, 3)
}

// Safe / Competitive / At risk against historical median ± 1 SD.
// Same formula as backend/features/bidding/utils/referenceBid.js; select comparable history first.
export function rateBid(amount, history) {
  if (!Number.isFinite(amount) || !history.length || new Set(history.map(h => h.round)).size !== 1 || history.some(h => !Number.isFinite(h.median) || h.median < 0)) return null
  const medians = history.map((h) => h.median)
  const mean = medians.reduce((a, b) => a + b, 0) / medians.length
  const sd = Math.sqrt(medians.reduce((a, m) => a + (m - mean) ** 2, 0) / medians.length)
  let rating = 'at-risk'
  if (amount >= mean + sd) rating = 'safe'
  else if (amount >= mean - sd) rating = 'competitive'
  return { rating, mean, sd }
}
