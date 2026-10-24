// Turns a What-If plan into the degree checklist. Pure functions.
//   cleared    = module sits in a semester before the plan's current one
//   inProgress = module sits in the current semester (being taken now)
//   planned    = module sits in a later semester
//   todo    = nothing in the plan fills this slot yet
import { degreeGroups, gradRequirements, globalExposure, BASKETS, HOW, SEM_IDS, ANY_TERM } from '../data/degree'
import { effectiveCode } from './requirementChecker'
import { tracks as trackInfo } from '../data/catalogue'
import { curriculumCandidates } from './curriculumChecklist'

// "Y2S1" -> 3, so semesters compare as numbers
const semNum = (id) => {
  const [y, s] = id.match(/\d/g).map(Number)
  return (y - 1) * 2 + s
}

const windowLabel = ([a, b]) => (a === b ? a : `${a}–${b}`)
const idsIn = ([a, b]) => SEM_IDS.filter((id) => semNum(id) >= semNum(a) && semNum(id) <= semNum(b))

// A module from the backend catalogue carrying the slot's tag (e.g. CORE:NUMERACY) fills it too
const hasTag = (slot, mod) => !!slot.tag && !!mod.fulfils?.includes(slot.tag)

// Order matters: specific rules claim modules before the generic ones.
const PASSES = ['codes', 'trackList', 'basket', 'track', 'anyIs', 'free', 'leftover']

function fits(pass, slot, mod, plan) {
  if (pass === 'codes') return slot.rule === 'codes' && (slot.codes.includes(mod.code) || hasTag(slot, mod))
  if (pass === 'trackList') return slot.rule === 'trackList' && slot.codes.includes(mod.code)
  if (pass === 'basket') return slot.rule === 'basket' && mod.basket === slot.basket
  if (pass === 'track') return slot.rule === 'track' && mod.category === 'track' && !!mod.tracks?.includes(plan.tracks[0])
  if (pass === 'anyIs') return slot.rule === 'anyIs' && (mod.category === 'track' || mod.category === 'depth')
  if (pass === 'free') return slot.rule === 'free' && mod.category === 'free'
  // spare track / depth modules overflow into free electives
  return slot.rule === 'free' && (mod.category === 'track' || mod.category === 'depth')
}

function detailFor(slot, plan) {
  if (slot.rule === 'trackList') return slot.pickText
  if (slot.rule === 'basket') return `Pick from the ${BASKETS[slot.basket]} basket`
  if (slot.rule === 'track') return `Pick from your ${plan.tracks[0] ?? 'first'} track`
  if (slot.rule === 'anyIs') return 'Any IS track, depth or related course'
  if (slot.rule === 'free') return 'Any SMU course'
  return [slot.title, HOW[slot.how], slot.note].filter(Boolean).join(' · ')
}

// The degree's groups for this plan. With the backend's track requirements (trackReqs), each of the plan's tracks
// gets its own lines: its compulsory course (if it has one) and the courses to pick from its list, 4 CU per track.
// One track: those 4 lines + 2 "Any IS track / depth / ISRC" lines. Two tracks: 8 track lines, which take the place
// of the 2 "Any IS" lines and 2 free electives, so the degree is still 36 courses.
// Without trackReqs (offline), the sample groups with "IS Track Course 1-4" for the first track.
function groupsFor(plan, trackReqs) {
  const chosen = plan.tracks.filter((t) => trackReqs?.[t]).slice(0, 2)
  if (!chosen.length) return degreeGroups

  const electives = degreeGroups.find((g) => g.key === 'major-elective')
  const trackWindows = electives.slots.filter((s) => s.rule === 'track').map((s) => s.window)
  const laterWindow = ['Y3S1', 'Y4S2']

  const trackSlots = chosen.flatMap((code, ti) => {
    const { name, reqs } = trackReqs[code]
    const short = trackInfo.find((t) => t.code === code)?.short ?? name
    let line = 0
    let pick = 0
    return reqs.flatMap((r) => {
      const compulsory = /compulsory/i.test(r.label)
      return Array.from({ length: r.count }, () => {
        const window = ti === 0 ? (trackWindows[line] ?? laterWindow) : laterWindow
        line++
        if (!compulsory) pick++
        return {
          id: `track-${code}-${line}`,
          label: compulsory ? `${short} · Compulsory track course` : `${short} · Track course ${pick}`,
          code: compulsory && r.codes.length === 1 ? r.codes[0] : undefined,
          rule: 'trackList',
          codes: r.codes,
          window,
          pickText: compulsory
            ? r.codes.length === 1
              ? `Compulsory for ${name}`
              : `Any 1 of ${r.codes.join(' / ')}`
            : `Pick from ${r.codes.length} ${name} courses`,
        }
      })
    })
  })

  const dual = chosen.length === 2
  return degreeGroups.map((g) => {
    if (g.key === 'major-elective') {
      return { ...g, slots: [...trackSlots, ...(dual ? [] : g.slots.filter((s) => s.rule === 'anyIs'))] }
    }
    if (g.key === 'free' && dual) return { ...g, slots: g.slots.slice(0, 4) }
    return g
  })
}

// A semester before the current one is done, the current one is being taken, later ones are planned
const statusAt = (i, nowIdx) => (i < nowIdx ? 'cleared' : i === nowIdx ? 'inProgress' : 'planned')

// Every catalogue module in the plan (one entry per code, exchange mappings resolved), with where it sits.
// Exempted modules count as cleared, with 'Exempt' in place of a semester.
export function placedModules(plan, catalogue, exempted = []) {
  const nowIdx = plan.semesters.findIndex((s) => s.id === plan.currentSem)
  const placed = []
  const seen = new Set()
  plan.semesters.forEach((sem, i) => {
    if (sem.loa) return
    sem.modules.forEach((entry) => {
      const code = effectiveCode(entry)
      const mod = catalogue[code]
      if (!mod || seen.has(code)) return
      seen.add(code)
      placed.push({ mod, semId: sem.id, status: statusAt(i, nowIdx) })
    })
  })
  exempted.forEach((code) => {
    const mod = catalogue[code]
    if (!mod || seen.has(code)) return
    seen.add(code)
    placed.push({ mod, semId: 'Exempt', status: 'cleared', exempt: true })
  })
  return placed
}

// How a recommended window [first, last] relates to the plan's current semester.
export function semTools(plan) {
  const nowNum = semNum(plan.currentSem)

  const urgencyOf = (win) => {
    if (nowNum > semNum(win[1])) return 'late'
    if (nowNum >= semNum(win[0])) return 'due'
    return 'later'
  }

  // now | later | late
  const toneOf = (win) => ({ late: 'late', due: 'now', later: 'later' })[urgencyOf(win)]

  // rec: everything the hover needs. chip: the one semester tag shown in the list.
  //   planned -> the semester it sits in (blue)   inProgress -> being taken this semester (amber)
  //   now -> recommended for the current semester (green)
  //   later -> first recommended semester (grey)   late -> last recommended semester, already passed (red)
  const recFor = (win, placedId) => ({ ids: idsIn(win), tone: toneOf(win), label: windowLabel(win), now: plan.currentSem, placed: placedId })
  const chipFor = (win, placedId, status) => {
    if (placedId) return { text: placedId, tone: status === 'inProgress' ? 'inProgress' : 'planned' }
    const tone = toneOf(win)
    return { text: tone === 'now' ? plan.currentSem : tone === 'later' ? win[0] : win[1], tone }
  }

  return { urgencyOf, recFor, chipFor }
}

/**
 * @param {{ tracks: string[], currentSem: string, semesters: Array<{ id, loa, exchange, modules: string[] }> }} plan
 * @param {Record<string, { code, name, category, tracks, basket, grad }>} catalogue modules by code
 * @param {object} [options]
 * @param {string[]} [options.exempted] codes of modules the student is exempted from
 * @param {number} [options.freeExempt] free electives the student is exempted from (not tied to a module)
 * @param {string[]} [options.markedDone] ids of lines the student marked as done (see MARK_DONE in data/degree.js)
 * @param {Record<string, { name, reqs }>} [options.trackReqs] the backend's requirements per track (see stores/catalogue.js)
 */
export function buildChecklist(plan, catalogue, { exempted = [], freeExempt = 0, markedDone = [], trackReqs = null } = {}) {
  const nowIdx = plan.semesters.findIndex((s) => s.id === plan.currentSem)
  const placed = placedModules(plan, catalogue, exempted)
  const { urgencyOf, recFor, chipFor } = semTools(plan)

  const groups = groupsFor(plan, trackReqs).map((g) => ({
    key: g.key,
    label: g.label,
    slots: g.slots.map((s) => ({ ...s, match: null })),
  }))
  const allSlots = groups.flatMap((g) => g.slots)

  // Free elective exemptions clear "SMU Course" lines before any module is matched
  allSlots
    .filter((s) => s.rule === 'free')
    .slice(0, freeExempt)
    .forEach((s) => (s.match = { mod: null, semId: 'Exempt', status: 'cleared', note: 'Free elective exemption' }))

  // Lines the student marked as done themselves (Internship, Community Service)
  allSlots
    .filter((s) => markedDone.includes(s.id))
    .forEach((s) => (s.match = { mod: null, semId: 'Done', status: 'cleared', note: 'Marked as done' }))

  const used = new Set()
  PASSES.forEach((pass) => {
    allSlots.forEach((slot) => {
      if (slot.match) return
      const hit = placed.find((p) => !used.has(p.mod.code) && fits(pass, slot, p.mod, plan))
      if (hit) {
        slot.match = hit
        used.add(hit.mod.code)
      }
    })
  })

  const out = groups.map((g) => {
    const slots = g.slots.map((s) => {
      const base = {
        id: s.id,
        label: s.label,
        code: s.code ?? null,
        title: s.title ?? null,
        rule: s.rule,
        basket: s.basket ?? null,
        codes: s.codes ?? [],
        tag: s.tag ?? null,
        pickText: s.pickText ?? null,
        how: s.how ?? null,
        note: s.note ?? null,
      }
      if (s.match) {
        const { mod, semId, status, exempt } = s.match
        const detail = mod ? `${mod.code} · ${mod.name}${exempt ? ' (exempted)' : ''}` : s.match.note
        return { ...base, status, urgency: null, semId, rec: recFor(s.window, semId), chip: chipFor(s.window, semId, status), detail }
      }
      return { ...base, status: 'todo', urgency: urgencyOf(s.window), semId: null, rec: recFor(s.window, null), chip: chipFor(s.window, null), detail: detailFor(s, plan) }
    })
    const count = (st) => slots.filter((s) => s.status === st).length
    return { key: g.key, label: g.label, slots, cleared: count('cleared'), inProgress: count('inProgress'), planned: count('planned'), todo: count('todo') }
  })

  const flat = out.flatMap((g) => g.slots)
  const totals = {
    required: flat.length, // TOTAL_COURSES (36) with the standard groups
    cleared: flat.filter((s) => s.status === 'cleared').length,
    inProgress: flat.filter((s) => s.status === 'inProgress').length,
    planned: flat.filter((s) => s.status === 'planned').length,
    todo: flat.filter((s) => s.status === 'todo').length,
    late: flat.filter((s) => s.urgency === 'late').length,
  }

  // Graduation requirements can be double-counted, so look at every placed module (not just matched ones).
  const grad = gradRequirements.map((r) => {
    if (r.auto) {
      return { id: r.key, label: r.label, rule: 'grad', gradKey: r.key, detail: r.detail, status: 'cleared', urgency: null, semId: null, rec: recFor(ANY_TERM, null), chip: chipFor(ANY_TERM, null) }
    }
    const hits = placed.filter((p) => p.mod.grad?.includes(r.key))
    const best = hits.find((p) => p.status === 'cleared') ?? hits.find((p) => p.status === 'inProgress') ?? hits[0]
    return {
      id: r.key,
      label: r.label,
      rule: 'grad',
      gradKey: r.key,
      detail: best ? `${best.mod.code} · ${best.mod.name}` : r.detail,
      status: best ? best.status : 'todo',
      urgency: null,
      semId: best?.semId ?? null,
      rec: recFor(ANY_TERM, best?.semId ?? null),
      chip: chipFor(ANY_TERM, best?.semId ?? null, best?.status),
    }
  })

  // Global Exposure: an exchange semester in the plan, or marked as done by the student
  const abroad = plan.semesters.findIndex((s) => s.exchange)
  const marked = markedDone.includes('exposure')
  const exposure = {
    id: 'exposure',
    label: globalExposure.label,
    rule: 'exposure',
    detail: marked ? 'Marked as done' : globalExposure.detail,
    status: marked ? 'cleared' : abroad === -1 ? 'todo' : statusAt(abroad, nowIdx),
    urgency: !marked && abroad === -1 ? urgencyOf(globalExposure.window) : null,
    semId: marked || abroad === -1 ? null : plan.semesters[abroad].id,
  }
  exposure.rec = recFor(globalExposure.window, exposure.semId)
  exposure.chip = chipFor(globalExposure.window, exposure.semId, exposure.status)

  return { groups: out, totals, other: [exposure, ...grad] }
}

/**
 * The modules a student could pick for a checklist item, each with where it already sits in the plan (or null).
 * Fixed courses that are not in the catalogue yet come back as a single `stub` entry.
 * With the backend, `catalogue` is the real module catalogue in this shape (see stores/catalogue.js).
 */
export function candidatesFor(item, plan, catalogue, exempted = []) {
  const where = new Map(placedModules(plan, catalogue, exempted).map((p) => [p.mod.code, { status: p.status, semId: p.semId }]))
  const all = Object.values(catalogue)

  let list = []
  if (item.rule === 'curriculum') list = curriculumCandidates(item, catalogue)
  else if (item.rule === 'trackList') list = all.filter((m) => item.codes.includes(m.code))
  else if (item.rule === 'codes') {
    list = all.filter((m) => item.codes.includes(m.code) || hasTag(item, m))
    if (!list.length) list = [{ code: item.code ?? '', name: item.title ?? item.label, stub: true }]
  } else if (item.rule === 'basket') list = all.filter((m) => m.basket === item.basket)
  else if (item.rule === 'track') list = all.filter((m) => m.category === 'track' && m.tracks?.includes(plan.tracks[0]))
  else if (item.rule === 'anyIs') list = all.filter((m) => m.category === 'track' || m.category === 'depth')
  else if (item.rule === 'free') list = all
  else if (item.rule === 'grad') list = all.filter((m) => m.grad?.includes(item.gradKey))

  return list
    .map((m) => ({ ...m, key: m.code || item.id, placement: where.get(m.code) ?? null }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

/**
 * Facts about one module for the student: have they taken it, which semesters the course sequence recommends it,
 * which degree requirements it can count as, and which graduation requirements it fulfils.
 * `rec` is null when the module is not part of the standard IS course sequence.
 * TODO(backend): "taken before" should come from the student's completed-module history, not just the plan.
 */
export function moduleFacts(mod, plan, catalogue) {
  const here = placedModules(plan, catalogue).find((p) => p.mod.code === mod.code) ?? null
  const { recFor, chipFor } = semTools(plan)

  const matches = degreeGroups.flatMap((g) =>
    g.slots
      .filter((s) => ['codes', 'basket', 'track', 'anyIs', 'free'].some((pass) => fits(pass, s, mod, plan)))
      .map((s) => ({ slot: s, name: s.rule === 'codes' || s.rule === 'basket' ? s.label : g.label })),
  )

  let rec = null
  let chip = null
  if (matches.length) {
    const starts = matches.map((m) => semNum(m.slot.window[0]))
    const ends = matches.map((m) => semNum(m.slot.window[1]))
    const first = matches.find((m) => semNum(m.slot.window[0]) === Math.min(...starts)).slot.window[0]
    const last = matches.find((m) => semNum(m.slot.window[1]) === Math.max(...ends)).slot.window[1]
    rec = recFor([first, last], here?.semId ?? null)
    chip = chipFor([first, last], here?.semId ?? null)
  }

  return {
    taken: here ? { status: here.status, semId: here.semId } : null,
    countsAs: [...new Set(matches.map((m) => m.name))],
    rec,
    chip,
    grad: mod.grad ?? [],
  }
}
