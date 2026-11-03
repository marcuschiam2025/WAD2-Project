// Presentation of the live curriculum checklist (curriculumChecklist.js), without changing what it counts:
//   - headings follow the course progression: "University Core · Capabilities", "IS Major Core", "IS Major Electives",
//     "Free Electives", with the track requirements under "IS Major Electives" (named after their track)
//   - every requirement gets a recommended semester window from the course progression (data/degree.js), so the
//     semester tag can be hovered to see every recommended semester. The database stores no semester recommendations.
// Rows, statuses and credit counts are the curriculum builder's own.
import { degreeGroups, globalExposure, SEM_IDS, ANY_TERM } from '../data/degree'
import { tracks as trackInfo } from '../data/catalogue'
import { semTools } from './degreeChecklist'

const slots = degreeGroups.flatMap((g) => g.slots)
const num = (id) => SEM_IDS.indexOf(id)
// The earliest start and latest end of several windows
const span = (wins) =>
  wins.length ? [SEM_IDS[Math.min(...wins.map((w) => num(w[0])))], SEM_IDS[Math.max(...wins.map((w) => num(w[1])))]] : null

const BASKET_KEY = {
  'CORE:MANAGING': 'managing',
  'CORE:TECH_SCIENCE_SOCIETY': 'tss',
  'CORE:CULTURES_MODERN_WORLD': 'cmw',
}

// When the course progression recommends taking what this requirement asks for
function windowFor(r) {
  const wins = []
  // Listed courses the progression names (IS114 in Y1S1, IS213 in Y2S2, ...)
  if (['all', 'chooseN'].includes(r.rule)) {
    for (const code of r.modules ?? []) {
      const s = slots.find((x) => x.rule === 'codes' && x.codes.includes(code))
      if (s) wins.push(s.window)
    }
  }
  // Baskets and tagged requirements (Managing, Cultures of the Modern World, Internship, Global Exposure, ...)
  if (r.tag) {
    const s = slots.find((x) => x.rule === 'basket' && x.basket === BASKET_KEY[r.tag]) ?? slots.find((x) => x.tag === r.tag)
    if (s) wins.push(s.window)
    if (r.tag === 'CORE:GLOBAL_EXPOSURE') wins.push(globalExposure.window)
  }
  // Electives: the progression's track, IS elective and free elective slots
  if (!wins.length && r.level === 'track') slots.filter((x) => x.rule === 'track').forEach((x) => wins.push(x.window))
  if (!wins.length && r.countsToward === 'MAJOR_ELECTIVES') slots.filter((x) => x.rule === 'anyIs').forEach((x) => wins.push(x.window))
  if (!wins.length && r.countsToward === 'FREE_ELECTIVES') slots.filter((x) => x.rule === 'free').forEach((x) => wins.push(x.window))
  return span(wins) ?? ANY_TERM
}

const CORE_GROUPS = { Capabilities: 'uni-cap', Communities: 'uni-com', Civilisations: 'uni-civ' }
const ORDER = ['uni-cap', 'uni-com', 'uni-civ', 'major-core', 'major-elective', 'free']

// Which spreadsheet-style group a requirement is listed under ("IS" comes from the major, e.g. BSC-IS)
function groupFor(r, abbr) {
  if (r.level === 'core') {
    const key = CORE_GROUPS[r.heading]
    return { key: key ?? `core-${r.heading ?? ''}`, label: `University Core${r.heading ? ` · ${r.heading}` : ''}` }
  }
  if (r.level === 'track' || r.countsToward === 'MAJOR_ELECTIVES') return { key: 'major-elective', label: `${abbr} Major Electives` }
  if (r.countsToward === 'MAJOR_CORE') return { key: 'major-core', label: `${abbr} Major Core` }
  if (r.countsToward === 'FREE_ELECTIVES') return { key: 'free', label: 'Free Electives' }
  return { key: `major-${r.heading ?? ''}`, label: r.heading ?? 'Major' }
}

// Credits per status for each requirement, counting every course ONCE across the whole checklist. The curriculum
// builder lets a course count for several requirements (an additional track's courses "may also count elsewhere"),
// which is right for ticking requirements off but would count that course twice in a total.
// Specific requirements claim courses before the "any course" ones. An additional track claims nothing: its rows only
// show progress, and its courses count once through the IS electives and free electives, so the degree stays at its
// own total (e.g. 36 courses) however many tracks the student takes.
const PASS = { all: 0, chooseN: 1, basket: 2, anyFromCategory: 3 }
// 0 cleared, 1 exempted, 2 in progress, 3 planned: the order a course is preferred in, and its slot in the credit counts
const RANK = (t) => (t.exempt ? 1 : { cleared: 0, inProgress: 2, planned: 3 }[t.status] ?? 3)
const round = (n) => Math.round(n * 10) / 10

function creditFor(rows) {
  const claimed = new Set()
  const credit = new Map()
  const claimOrder = rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => row.requirement.rule !== 'flag')
    .sort((a, b) => (PASS[a.row.requirement.rule] ?? 3) - (PASS[b.row.requirement.rule] ?? 3) || a.i - b.i)
    .sort((a, b) => Number(!!a.row.extra) - Number(!!b.row.extra))
  for (const { row } of claimOrder) {
    const required = row.requirement.cuRequired ?? 0
    const used = [0, 0, 0, 0]
    const heldNow = [] // the courses this requirement ends up holding (each course is held by one requirement)
    let left = required
    if (row.marked) {
      used[0] = left // marked as done by the student: no course needed
      left = 0
    } else {
      const avail = (row.extra ? row.taken : row.taken.filter((t) => !claimed.has(t.code))).sort((a, b) => RANK(a) - RANK(b))
      let freeDone = false
      const useFree = () => {
        freeDone = true
        const v = Math.min(left, row.freeCredit ?? 0) // free elective exemptions sit with the exempted courses
        used[1] += v
        left -= v
      }
      for (const t of avail) {
        if (!freeDone && RANK(t) >= 2) useFree()
        if (left <= 0) break
        const v = Math.min(t.cu, left)
        used[RANK(t)] += v
        left -= v
        if (!row.extra) claimed.add(t.code)
        heldNow.push({ code: t.code, semId: t.semId })
      }
      if (!freeDone) useFree()
    }
    credit.set(row.id, {
      required, cleared: round(used[0]), exempted: round(used[1]), inProgress: round(used[2]), planned: round(used[3]), todo: round(Math.max(0, left)),
      held: heldNow,
    })
  }
  return credit
}

// A requirement's status from the credit it holds: done by cleared courses, by those in progress, or only with planned ones
function statusFromCredit(c) {
  if (c.todo > 0) return 'todo'
  if (c.inProgress === 0 && c.planned === 0) return c.cleared === 0 && c.exempted > 0 ? 'exempted' : 'cleared'
  return c.planned === 0 ? 'inProgress' : 'planned'
}

/**
 * @param result    buildCurriculumChecklist(...)
 * @param plan      the plan it was built for
 * @param bundle    the curriculum bundle it was built from (GET /api/majors/:id/requirements)
 * @param majorCode e.g. 'BSC-IS', for the "IS" in "IS Major Core"
 */
export function layoutCurriculum(result, plan, bundle, { majorCode = '' } = {}) {
  const abbr = majorCode.split('-').pop() || 'Major'
  const { recFor, chipFor, urgencyOf } = semTools(plan)

  function present(row) {
    const r = row.requirement
    const win = windowFor(r)
    // A row still to do is tagged with the recommended semester; one already in the plan with where it sits
    const placed = row.status === 'todo' ? null : row.semId
    const track = r.level === 'track' ? bundle.tracks?.find((t) => t._id === r.ownerId) : null
    const trackName = track ? (trackInfo.find((t) => t.code === track.trackCode)?.short ?? track.name) : null
    return {
      ...row,
      label: trackName ? `${trackName} · ${row.label}` : row.label,
      trackCode: track?.trackCode ?? null,
      urgency: row.status === 'todo' ? urgencyOf(win) : null,
      rec: recFor(win, placed),
      chip: chipFor(win, placed, row.status),
    }
  }

  // What a requirement shows once each course is held by one requirement only. The builder lets a course count for
  // several (an additional track's courses also fall into "Any IS course" and the free electives); here each row keeps
  // only the courses it holds, so its status, progress and course list match the totals.
  function settle(row, credit) {
    if (!credit || row.marked) return row
    const r = row.requirement
    const status = statusFromCredit(credit)
    const filled = round(credit.required - credit.todo)
    const codes = credit.held.map((h) => h.code)
    return {
      ...row,
      status,
      semId: status === 'cleared' || status === 'exempted' ? null : (credit.held.at(-1)?.semId ?? null),
      detail: `${filled} / ${credit.required} CU included${r.rule === 'chooseN' ? ` · ${codes.length} / ${r.n} courses` : ''}${codes.length ? ` · ${codes.join(', ')}` : ''}${row.extra ? ' · Additional track' : ''}`,
    }
  }

  // Regroup the rows under the spreadsheet headings, keeping their order inside each group (tracks first)
  const credits = creditFor(result.groups.flatMap((g) => g.slots))
  const groups = new Map()
  for (const g of result.groups) {
    for (const row of g.slots) {
      const target = groupFor(row.requirement, abbr)
      if (!groups.has(target.key)) groups.set(target.key, { key: target.key, label: target.label, slots: [] })
      groups.get(target.key).slots.push(present(settle(row, credits.get(row.id))))
    }
  }
  const ordered = [...groups.values()].sort((a, b) => {
    const ia = ORDER.indexOf(a.key)
    const ib = ORDER.indexOf(b.key)
    return (ia === -1 ? ORDER.length : ia) - (ib === -1 ? ORDER.length : ib)
  })
  for (const g of ordered) {
    g.slots.sort((a, b) => Number(a.requirement.level !== 'track') - Number(b.requirement.level !== 'track')) // track requirements first (stable)
    for (const status of ['cleared', 'exempted', 'inProgress', 'planned', 'todo']) g[status] = g.slots.filter((s) => s.status === status).length
  }

  const other = result.other.map(present)
  // Totals are counted in courses (credits), not requirements: a requirement only part met still has its courses
  // counted as cleared / in progress / planned, each course once, and what is left is "not in your plan yet".
  // Flags carry no credit.
  for (const g of ordered) for (const s of g.slots) s.credit = credits.get(s.id) ?? null
  // Additional-track rows only show progress; they are not extra courses on top of the degree
  const rows = ordered.flatMap((g) => g.slots).filter((r) => !r.extra)
  const add = (key) => round(rows.reduce((n, r) => n + (r.credit?.[key] ?? 0), 0))
  const late = round(rows.filter((r) => r.urgency === 'late').reduce((n, r) => n + (r.credit?.todo ?? 0), 0))
  return {
    ...result,
    groups: ordered,
    other,
    hasRecommendations: true,
    byCredit: true,
    totals: {
      required: add('required'), cleared: add('cleared'), exempted: add('exempted'),
      inProgress: add('inProgress'), planned: add('planned'), todo: add('todo'), late,
    },
  }
}
