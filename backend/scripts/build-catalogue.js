// Builds data/*.json (the planning catalogue that `pnpm seed` loads) from:
//   - the SMU courses report CSV: every undergraduate course, its requisites, tracks and requirement areas
//   - the team's seed folder: schools, majors, tracks and graduation requirements (copied as is),
//     plus modules.json for courses the CSV doesn't list and tags the CSV doesn't carry
//   - bidResults.json in the seed folder: which terms each course actually ran in
//   - data/bidhistories.json and data/sections.json (if built): the latest term each course ran in
// Usage: pnpm build-catalogue <courses-report.csv> <seed folder>
// New term's sections? Run build-catalogue, then build-sections, then build-catalogue again so lastOffered sees them.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseRequisite, splitCodes } from '../features/planning/utils/requisites.js'
import { parseCsv } from './utils/parseCsv.js'

const csvPath = process.argv[2]
const seedDir = process.argv[3]
if (!csvPath || !seedDir) {
  console.error('Usage: pnpm build-catalogue <courses-report.csv> <seed folder>')
  process.exit(1)
}

const OUTPUT_FOLDER = new URL('../data/', import.meta.url)

// Requirement areas in the CSV → the tags requirements.json matches with rule "basket" / "flag"
const AREA_TAGS = {
  'AREA - Capabilities - Managing': 'CORE:MANAGING',
  'AREA - Capabilities - Modes of Thinking': 'CORE:MODES_OF_THINKING',
  'AREA - Communities - Cultures of the Modern World': 'CORE:CULTURES_MODERN_WORLD',
  'AREA - Communities - Technology, Science and Society': 'CORE:TECH_SCIENCE_SOCIETY',
  'AREA - Grad Req - Dig Tech/Data Ana (Intake 2024 onwards)': 'GRAD:DIGITAL_TECH',
  'AREA - Grad Req - Sustainability (Intake 2024 onwards)': 'GRAD:SUSTAINABILITY',
  'AREA - Grad Req - SG & Asia Studies (Intake 2024 onwards)': 'GRAD:SG_ASIA_STUDIES',
}

// e.g. "TRCK - IS/T4BS: Business Analytics Track" or "TRCK - IS Major: Software Development Track"
const IS_TRACK_ATTRIBUTE = /^TRCK - IS( Major|\/T4BS):/

// Free-text requisites (min grades, CU counts, permission) — kept for display only
const NOTE_ATTRIBUTE = /^RQ(SR|CU|GP|PL|CL|CS) - /

// Requirements the planner leaves out: community service isn't planned in semesters
const EXCLUDED_TAGS = ['CORE:COMMUNITY_SERVICE']

// SMU records the internship as COR1001, which the courses report leaves out, so the planner adds
// it here. Students can place it in a semester or an LOA term. It fills the "Internship" requirement.
const INTERNSHIP_MODULE = {
  _id: 'COR1001',
  title: 'Internship',
  cu: 1,
  schoolId: null,
  department: null,
  description: 'Planner entry for the internship graduation requirement. Place it in a semester or an LOA term.',
  categories: [],
  fulfils: ['CORE:INTERNSHIP'],
  prerequisites: [],
  corequisites: [],
  mutuallyExclusive: [],
  termsOffered: [],
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function readSeedFile(fileName) {
  const text = readFileSync(join(seedDir, fileName), 'utf8')
  return JSON.parse(text)
}

function writeDataFile(fileName, data) {
  const text = JSON.stringify(data, null, 2) + '\n'
  writeFileSync(new URL(fileName, OUTPUT_FOLDER), text)
}

// "AREA - X, RQCP - A/B, TRCK - Y" → ['AREA - X', 'RQCP - A/B', 'TRCK - Y']
// Only split on commas followed by a 4-character prefix, so commas inside a value are kept.
function splitAttributes(text) {
  const parts = text.split(/,\s*(?=[A-Z0-9]{4} - )/)
  const attributes = []
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed) {
      attributes.push(trimmed)
    }
  }
  return attributes
}

// The value of the first attribute with this prefix, e.g. value(attrs, 'RQCP') → 'IS217/MGMT108'
function attributeValue(attributes, prefix) {
  for (const attribute of attributes) {
    if (attribute.startsWith(`${prefix} - `)) {
      return attribute.slice(prefix.length + 3)
    }
  }
  return undefined
}

// Every attribute with this prefix. A course can list several, e.g. IS212 has
// "RQCP - IS112/IS105" and "RQCP - IS113": each one is a separate requirement, all of which apply.
function attributeValues(attributes, prefix) {
  const values = []
  for (const attribute of attributes) {
    if (attribute.startsWith(`${prefix} - `)) {
      values.push(attribute.slice(prefix.length + 3))
    }
  }
  return values
}

// All of a course's requisite lines of one kind as AND-of-OR groups, e.g. [["IS112","IS105"],["IS113"]]
function requisiteGroups(attributes, prefix, subject) {
  const groups = []
  const seen = new Set()
  for (const text of attributeValues(attributes, prefix)) {
    for (const group of parseRequisite(text, subject)) {
      const key = [...group].sort().join('|')
      if (!seen.has(key)) {
        seen.add(key)
        groups.push(group)
      }
    }
  }
  return groups
}

// ---------------------------------------------------------------------------------------------
// Load the inputs
// ---------------------------------------------------------------------------------------------

const csvRows = parseCsv(readFileSync(csvPath, 'utf8')).slice(1) // skip the header row
const schools = readSeedFile('schools.json')
const majors = readSeedFile('majors.json')
const tracks = readSeedFile('tracks.json')
const requirements = readSeedFile('requirements.json').filter(
  (requirement) => !EXCLUDED_TAGS.includes(requirement.tag),
)

const seedModules = {} // code -> module from the team's seed
for (const mod of readSeedFile('modules.json')) {
  seedModules[mod._id] = mod
}

const bossCodeOf = {} // school id -> BOSS department code, e.g. SCIS -> SIS
for (const school of schools) {
  bossCodeOf[school._id] = school.bossCode
}

// Terms each course ran in over the last three academic years of bidding data, e.g. IS460 -> {T1, T2}
const recentTerms = {}
const bids = readSeedFile('bidResults.json')
const allYears = new Set()
for (const bid of bids) {
  allYears.add(bid.termKey.split('_')[0]) // "2025-26_T1" -> "2025-26"
}
const lastThreeYears = [...allYears].sort().slice(-3)
for (const bid of bids) {
  const [year, term] = bid.termKey.split('_')
  if (!lastThreeYears.includes(year)) {
    continue
  }
  if (!recentTerms[bid.moduleCode]) {
    recentTerms[bid.moduleCode] = new Set()
  }
  recentTerms[bid.moduleCode].add(term)
}

// The latest term each course ran in, e.g. IS460 -> "AY26/27 T2", from every source of offerings:
// the seed's bid results, the BOSS bid history (data/bidhistories.json) and next term's sections (data/sections.json)
const lastOffered = {}
function recordOffered(code, term) {
  // "AY25/26 T2" < "AY26/27 T1" as strings, so the larger string is the later term
  if (!lastOffered[code] || term > lastOffered[code]) {
    lastOffered[code] = term
  }
}
for (const bid of bids) {
  const [year, term] = bid.termKey.split('_') // "2025-26", "T1"
  recordOffered(bid.moduleCode, `AY${year.slice(2, 4)}/${year.slice(5)} ${term}`)
}
for (const fileName of ['bidhistories.json', 'sections.json']) {
  const file = new URL(fileName, OUTPUT_FOLDER)
  if (!existsSync(file)) {
    continue
  }
  for (const row of JSON.parse(readFileSync(file, 'utf8'))) {
    recordOffered(row.module, row.term)
  }
}

// A course counts as offered recently when it ran in one of the 4 latest terms we have data for (about 2 years)
const RECENT_TERM_COUNT = 4
const knownTerms = [...new Set(Object.values(lastOffered))].sort()
const oldestRecentTerm = knownTerms[Math.max(0, knownTerms.length - RECENT_TERM_COUNT)]

// Modules named in a track's requirement lists count as track courses even without a TRCK attribute
const trackListed = new Set()
for (const requirement of requirements) {
  if (requirement.level === 'track') {
    for (const code of requirement.modules ?? []) {
      trackListed.add(code)
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Build the modules
// ---------------------------------------------------------------------------------------------

const modules = {} // code -> module

for (const row of csvRows) {
  const level = row[0]
  const subject = row[1].trim()
  // The report writes some catalogue numbers with a leading dot (".446" for IS446), so drop it
  const catalogNumber = row[2].trim().replace(/^\./, '')
  const department = row[3]
  const title = row[4]
  const description = row[5]
  const attributes = splitAttributes(row[9])

  if (level !== 'Undergraduate') {
    continue
  }

  const code = subject + catalogNumber
  const seed = seedModules[code] // undefined if the team's seed doesn't have this course

  // Categories used by "anyFromCategory" requirements
  const categories = new Set(seed?.categories ?? [])
  if (subject === 'IS') {
    categories.add('IS')
  }
  const isTrackCourse = attributes.some((attribute) => IS_TRACK_ATTRIBUTE.test(attribute))
  if (isTrackCourse || trackListed.has(code)) {
    categories.add('IS_TRACK')
  }
  if (attributes.includes('AREA - IS Related Courses')) {
    categories.add('IS_RELATED')
  }

  // Tags used by "basket" / "flag" requirements
  const fulfils = new Set(seed?.fulfils ?? [])
  for (const attribute of attributes) {
    if (AREA_TAGS[attribute]) {
      fulfils.add(AREA_TAGS[attribute])
    }
  }

  // CU: from a "UNIT - 1.0 Unit" attribute, else the seed, else 1
  let cu = seed?.cu ?? 1
  const unitText = attributeValue(attributes, 'UNIT')
  const unitNumber = Number(unitText?.match(/[\d.]+/)?.[0])
  if (Number.isFinite(unitNumber)) {
    cu = unitNumber
  }

  // Terms: from the bidding data, else the seed
  let termsOffered = seed?.termsOffered ?? []
  if (recentTerms[code]) {
    termsOffered = [...recentTerms[code]].sort()
  }

  // Requisites: from the CSV, else the seed
  let prerequisites = requisiteGroups(attributes, 'RQCP', subject)
  if (prerequisites.length === 0) {
    prerequisites = seed?.prerequisites ?? []
  }
  let corequisites = requisiteGroups(attributes, 'RQCC', subject)
  if (corequisites.length === 0) {
    corequisites = seed?.corequisites ?? []
  }

  const requisiteNotes = []
  for (const attribute of attributes) {
    if (NOTE_ATTRIBUTE.test(attribute)) {
      requisiteNotes.push(attribute.slice(7)) // drop "RQSR - "
    }
  }

  const mod = {
    _id: code,
    title: title.trim(),
    cu: cu,
    schoolId: bossCodeOf[department] ? department : (seed?.schoolId ?? null),
    department: bossCodeOf[department] ?? department,
    description: description.trim(),
    categories: [...categories],
    fulfils: [...fulfils],
    prerequisites: prerequisites,
    corequisites: corequisites,
    mutuallyExclusive: [...new Set(attributeValues(attributes, 'RQCX').flatMap((text) => splitCodes(text, subject)))],
  }
  if (seed?.prerequisiteRules) {
    mod.prerequisiteRules = seed.prerequisiteRules
  }
  if (requisiteNotes.length > 0) {
    mod.requisiteNotes = requisiteNotes
  }
  mod.termsOffered = termsOffered

  modules[code] = mod
}

// Courses in the team's seed that the report doesn't list (renamed or not offered this year)
let carriedOver = 0
for (const mod of Object.values(seedModules)) {
  if (!modules[mod._id]) {
    modules[mod._id] = mod
    carriedOver++
  }
}

modules[INTERNSHIP_MODULE._id] = INTERNSHIP_MODULE

// Mark courses that haven't run lately (e.g. COR-IS1702, replaced by COR-IS1704). They stay in the
// catalogue for students who already took them, but module search hides them by default.
let notRecent = 0
for (const mod of Object.values(modules)) {
  mod.lastOffered = lastOffered[mod._id] ?? null
  mod.offeredRecently = mod._id === INTERNSHIP_MODULE._id || (mod.lastOffered !== null && mod.lastOffered >= oldestRecentTerm)
  if (!mod.offeredRecently) {
    notRecent++
  }
}

// Warn if a requirement names a course we don't have
const missing = new Set()
for (const requirement of requirements) {
  for (const code of requirement.modules ?? []) {
    if (!modules[code]) {
      missing.add(code)
    }
  }
}
if (missing.size > 0) {
  console.warn(`Requirements name courses missing from the catalogue: ${[...missing].join(', ')}`)
}

// ---------------------------------------------------------------------------------------------
// Write the output
// ---------------------------------------------------------------------------------------------

const sortedModules = Object.values(modules).sort((a, b) => a._id.localeCompare(b._id))
writeDataFile('modules.json', sortedModules)
writeDataFile('schools.json', schools)
writeDataFile('majors.json', majors)
writeDataFile('tracks.json', tracks)
writeDataFile('requirements.json', requirements)

console.log(
  `Wrote ${sortedModules.length} modules (${carriedOver} carried over from the seed), ` +
    `${schools.length} schools, ${majors.length} majors, ${tracks.length} tracks, ${requirements.length} requirements`,
)
console.log(`${notRecent} modules not offered since ${oldestRecentTerm} (offeredRecently: false)`)
