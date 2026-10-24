// Builds data/bidhistories.json (the BidHistory collection that `pnpm seed` loads) from BOSS bid
// result CSVs: one row per section per bidding window, as downloaded from BOSS and saved as CSV.
// Each module gets one entry per term and round, which is what referenceBid() compares against.
// Usage: pnpm build-bid-history <bid-results.csv> [more terms' CSVs…]
import { readFileSync, writeFileSync } from 'node:fs'
import { parseCsv } from './utils/parseCsv.js'

const csvPaths = process.argv.slice(2)
if (csvPaths.length === 0) {
  console.error('Usage: pnpm build-bid-history <bid-results.csv> [more terms\' CSVs…]')
  process.exit(1)
}

const OUTPUT_FILE = new URL('../data/bidhistories.json', import.meta.url)

// Only rounds open to returning students. Incoming Freshmen / Exchange rounds are left out.
const ROUND_WINDOW = /^Round (\w+) Window (\d+)$/

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

// "2025-26 Term 2" → "AY25/26 T2"
function toTerm(text) {
  const match = text.match(/^20(\d\d)-(\d\d) Term (\d)$/)
  if (!match) return null
  return `AY${match[1]}/${match[2]} T${match[3]}`
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

function round2(number) {
  return Math.round(number * 100) / 100
}

// ---------------------------------------------------------------------------------------------
// Read every CSV into section-window rows, grouped by module + term + round
// ---------------------------------------------------------------------------------------------

// "IS442|AY26/27 T1|1A" → the section-window rows in that round
const groups = new Map()

for (const csvPath of csvPaths) {
  const [header, ...rows] = parseCsv(readFileSync(csvPath, 'utf8'))
  const col = {}
  header.forEach((name, i) => (col[name] = i))

  let kept = 0
  for (const row of rows) {
    if (row.length < header.length) continue // blank line
    if (row[col['Session']] !== 'Regular Academic Session') continue

    const roundWindow = row[col['Bidding Window']].match(ROUND_WINDOW)
    const term = toTerm(row[col['Term']])
    if (!roundWindow || !term) continue

    const entry = {
      window: Number(roundWindow[2]),
      before: Number(row[col['Before Process Vacancy']]),
      after: Number(row[col['After Process Vacancy']]),
      median: Number(row[col['Median Bid']]),
      min: Number(row[col['Min Bid']]),
    }

    const key = `${row[col['Course Code']].trim()}|${term}|${roundWindow[1]}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(entry)
    kept++
  }
  console.log(`${csvPath}: ${kept} of ${rows.length} rows kept`)
}

// ---------------------------------------------------------------------------------------------
// One BidHistory entry per module + term + round
// ---------------------------------------------------------------------------------------------

const history = []
for (const [key, entries] of groups) {
  const [module, term, round] = key.split('|')

  // A 0 median means no seats were cleared by bids in that window, so it says nothing about price
  const cleared = entries.filter((entry) => entry.median > 0)
  if (cleared.length === 0) continue

  // Seats on offer when the round opened: the first window's vacancies across all sections
  let firstWindow = Infinity
  for (const entry of entries) {
    firstWindow = Math.min(firstWindow, entry.window)
  }
  let vacancies = 0
  let demand = 0
  for (const entry of entries) {
    if (entry.window === firstWindow) vacancies += entry.before
    demand += Math.max(0, entry.before - entry.after) // seats filled in that window
  }

  history.push({
    module,
    term,
    round,
    median: round2(median(cleared.map((entry) => entry.median))),
    min: round2(Math.min(...cleared.map((entry) => entry.min))),
    vacancies,
    demand,
  })
}

history.sort((a, b) => a.module.localeCompare(b.module) || a.term.localeCompare(b.term) || a.round.localeCompare(b.round))

writeFileSync(OUTPUT_FILE, JSON.stringify(history, null, 2) + '\n')
const modules = new Set(history.map((entry) => entry.module))
console.log(`bidhistories.json: ${history.length} entries for ${modules.size} modules`)
