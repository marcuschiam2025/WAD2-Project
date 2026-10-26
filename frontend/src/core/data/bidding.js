// Sample BOSS data for AY24/25 Sem 2. Shapes mirror backend/models/Section.js
// and backend/models/BidHistory.js. sections, bidHistory and weightage are reactive: the bidding store
// swaps in what GET /api/bidding/... returns for a module, and the sample stays for the rest.
import { reactive } from 'vue'

export const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const slots = [
  { start: '08:15', end: '11:30' },
  { start: '12:00', end: '15:15' },
  { start: '15:30', end: '18:45' },
  { start: '19:00', end: '22:15' },
]

export const sections = reactive([
  { id: 'IS212-G3', module: 'IS212', section: 'G3', day: 0, slot: 0, prof: 'Prof. Lwin Khin Shar', profShort: 'Prof. L. Shar', venue: 'SCIS Seminar Room 3-2', venueShort: 'SCIS SR 3-2', exam: '28 Apr 2025 · 13:00 – 16:00' },
  { id: 'IS212-G1', module: 'IS212', section: 'G1', day: 3, slot: 0, prof: 'Prof. A. Lee', profShort: 'Prof. A. Lee', venue: 'SCIS Seminar Room 2-3', venueShort: 'SCIS SR 2-3', exam: '28 Apr 2025 · 13:00 – 16:00' },
  { id: 'IS213-G1', module: 'IS213', section: 'G1', day: 1, slot: 1, prof: 'Prof. A. Tan', profShort: 'Prof. A. Tan', venue: 'SCIS Seminar Room 2-4', venueShort: 'SCIS SR 2-4', exam: '29 Apr 2025 · 09:00 – 12:00' },
  { id: 'IS213-G4', module: 'IS213', section: 'G4', day: 1, slot: 2, prof: 'Prof. A. Tan', profShort: 'Prof. A. Tan', venue: 'SCIS Seminar Room 3-1', venueShort: 'SCIS SR 3-1', exam: '29 Apr 2025 · 09:00 – 12:00' },
  { id: 'IS214-G2', module: 'IS214', section: 'G2', day: 2, slot: 0, prof: 'Prof. K. Lim', profShort: 'Prof. K. Lim', venue: 'SOE Seminar Room 2-1', venueShort: 'SOE SR 2-1', exam: '30 Apr 2025 · 13:00 – 16:00' },
  { id: 'IS215-G5', module: 'IS215', section: 'G5', day: 4, slot: 1, prof: 'Prof. R. Ng', profShort: 'Prof. R. Ng', venue: 'LKCSB Seminar Room 3-3', venueShort: 'LKCSB SR 3-3', exam: '2 May 2025 · 09:00 – 12:00' },
  { id: 'COR3001-G12', module: 'COR3001', section: 'G12', day: 3, slot: 2, prof: 'Prof. M. Chua', profShort: 'Prof. M. Chua', venue: 'SOSS Seminar Room 1-2', venueShort: 'SOSS SR 1-2', exam: 'No final exam' },
  { id: 'IS442-G1', module: 'IS442', section: 'G1', day: 2, slot: 3, prof: 'Prof. A. Tan', profShort: 'Prof. A. Tan', venue: 'SCIS Seminar Room 3-4', venueShort: 'SCIS SR 3-4', exam: '5 May 2025 · 13:00 – 16:00' },
  { id: 'IS442-G2', module: 'IS442', section: 'G2', day: 0, slot: 0, prof: 'Prof. A. Tan', profShort: 'Prof. A. Tan', venue: 'SCIS Seminar Room 3-4', venueShort: 'SCIS SR 3-4', exam: '5 May 2025 · 13:00 – 16:00' },
  { id: 'IS442-G3', module: 'IS442', section: 'G3', day: 4, slot: 1, prof: 'Prof. A. Tan', profShort: 'Prof. A. Tan', venue: 'SCIS Seminar Room 3-4', venueShort: 'SCIS SR 3-4', exam: '5 May 2025 · 13:00 – 16:00' },
])

// Historical bid results per module (last three terms)
export const bidHistory = reactive({
  IS212: [
    { term: 'AY24/25 T1', round: '1A', median: 38, min: 31 },
    { term: 'AY23/24 T2', round: '1A', median: 35, min: 28 },
    { term: 'AY23/24 T1', round: '1B', median: 33, min: 25 },
  ],
  IS213: [
    { term: 'AY24/25 T1', round: '1A', median: 30, min: 22 },
    { term: 'AY23/24 T2', round: '1A', median: 27, min: 20 },
    { term: 'AY23/24 T1', round: '1B', median: 24, min: 18 },
  ],
  IS214: [
    { term: 'AY24/25 T1', round: '1A', median: 22, min: 15 },
    { term: 'AY23/24 T2', round: '1A', median: 25, min: 17 },
    { term: 'AY23/24 T1', round: '1B', median: 19, min: 12 },
  ],
  IS215: [
    { term: 'AY24/25 T1', round: '1A', median: 18, min: 12 },
    { term: 'AY23/24 T2', round: '1A', median: 20, min: 13 },
    { term: 'AY23/24 T1', round: '1B', median: 16, min: 10 },
  ],
  COR3001: [
    { term: 'AY24/25 T1', round: '1A', median: 45, min: 36 },
    { term: 'AY23/24 T2', round: '1A', median: 41, min: 33 },
    { term: 'AY23/24 T1', round: '1B', median: 39, min: 30 },
  ],
  IS442: [
    { term: 'AY24/25 T1', round: '1A', median: 33, min: 26 },
    { term: 'AY23/24 T2', round: '1A', median: 31, min: 25 },
    { term: 'AY23/24 T1', round: '1B', median: 28, min: 21 },
  ],
})

// Past results for a single section (the room votes page shows these when you click a section).
// Sections without their own entry fall back to the module-level history above.
// TODO(backend): replace with GET /api/bidding/history?section=IS442-G1
export const sectionHistory = {
  'IS442-G1': [
    { term: 'AY24/25 T1', round: '1A', median: 35, min: 28 },
    { term: 'AY23/24 T2', round: '1A', median: 33, min: 27 },
    { term: 'AY23/24 T1', round: '1B', median: 29, min: 22 },
  ],
  'IS442-G2': [
    { term: 'AY24/25 T1', round: '1A', median: 31, min: 25 },
    { term: 'AY23/24 T2', round: '1A', median: 30, min: 24 },
    { term: 'AY23/24 T1', round: '1B', median: 26, min: 20 },
  ],
  'IS442-G3': [
    { term: 'AY24/25 T1', round: '1A', median: 34, min: 27 },
    { term: 'AY23/24 T2', round: '1A', median: 31, min: 25 },
    { term: 'AY23/24 T1', round: '1B', median: 28, min: 21 },
  ],
}

export const sectionBidHistory = (section) => sectionHistory[section.id] ?? bidHistory[section.module] ?? []

// Median and mean of the clearing medians across past terms (null when there is no history)
export function bidStats(history) {
  if (!history.length) return null
  const medians = history.map((h) => h.median).sort((a, b) => a - b)
  const mid = Math.floor(medians.length / 2)
  const median = medians.length % 2 ? medians[mid] : (medians[mid - 1] + medians[mid]) / 2
  const mean = medians.reduce((a, b) => a + b, 0) / medians.length
  return { median, mean: Math.round(mean * 10) / 10 }
}

export const weightage = reactive({
  IS212: [
    { label: 'Class participation', pct: 10 },
    { label: 'Project', pct: 40 },
    { label: 'Quizzes', pct: 20 },
    { label: 'Final exam', pct: 30 },
  ],
})

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
