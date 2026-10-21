// Turns a What-If plan into the degree checklist. Pure functions.
//   cleared = module sits in a semester before the plan's current one
//   planned = module sits in the current or a later semester
//   todo    = nothing in the plan fills this slot yet
import { degreeGroups, gradRequirements, globalExposure, BASKETS, HOW, TOTAL_COURSES, SEM_IDS, ANY_TERM } from '../data/degree'
import { effectiveCode } from './requirementChecker'

// "Y2S1" -> 3, so semesters compare as numbers
const semNum = (id) => {
  const [y, s] = id.match(/\d/g).map(Number)
  return (y - 1) * 2 + s
}

const windowLabel = ([a, b]) => (a === b ? a : `${a}–${b}`)
const idsIn = ([a, b]) => SEM_IDS.filter((id) => semNum(id) >= semNum(a) && semNum(id) <= semNum(b))

// Order matters: specific rules claim modules before the generic ones.
const PASSES = ['codes', 'basket', 'track', 'anyIs', 'free', 'leftover']

function fits(pass, slot, mod, plan) {
  if (pass === 'codes') return slot.rule === 'codes' && slot.codes.includes(mod.code)
  if (pass === 'basket') return slot.rule === 'basket' && mod.basket === slot.basket
  if (pass === 'track') return slot.rule === 'track' && mod.category === 'track' && !!mod.tracks?.includes(plan.tracks[0])
  if (pass === 'anyIs') return slot.rule === 'anyIs' && (mod.category === 'track' || mod.category === 'depth')
  if (pass === 'free') return slot.rule === 'free' && mod.category === 'free'
  // spare track / depth modules overflow into free electives
  return slot.rule === 'free' && (mod.category === 'track' || mod.category === 'depth')
}

function detailFor(slot, plan) {
  if (slot.rule === 'basket') return `Pick from the ${BASKETS[slot.basket]} basket`
  if (slot.rule === 'track') return `Pick from your ${plan.tracks[0] ?? 'first'} track`
  if (slot.rule === 'anyIs') return 'Any IS track, depth or related course'
  if (slot.rule === 'free') return 'Any SMU course'
  return [slot.title, HOW[slot.how], slot.note].filter(Boolean).join(' · ')
}

// Every catalogue module in the plan (one entry per code, exchange mappings resolved), with where it sits.
export function placedModules(plan, catalogue) {
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
      placed.push({ mod, semId: sem.id, status: i < nowIdx ? 'cleared' : 'planned' })
    })
  })
  return placed
}

// How a recommended window [first, last] relates to the plan's current semester.
function semTools(plan) {
  const nowNum = semNum(plan.currentSem)

  const urgencyOf = (win) => {
    if (nowNum > semNum(win[1])) return 'late'
    if (nowNum >= semNum(win[0])) return 'due'
    return 'later'
  }

  // now | later | late
  const toneOf = (win) => ({ late: 'late', due: 'now', later: 'later' })[urgencyOf(win)]

  // rec: everything the hover needs. chip: the one semester tag shown in the list.
  //   planned -> the semester it sits in (blue)   now -> current semester (green)
  //   later -> first recommended semester (grey)   late -> last recommended semester, already passed (red)
  const recFor = (win, placedId) => ({ ids: idsIn(win), tone: toneOf(win), label: windowLabel(win), now: plan.currentSem, placed: placedId })
  const chipFor = (win, placedId) => {
    if (placedId) return { text: placedId, tone: 'planned' }
    const tone = toneOf(win)
    return { text: tone === 'now' ? plan.currentSem : tone === 'later' ? win[0] : win[1], tone }
  }

  return { urgencyOf, recFor, chipFor }
}

/**
 * @param {{ tracks: string[], currentSem: string, semesters: Array<{ id, loa, exchange, modules: string[] }> }} plan
 * @param {Record<string, { code, name, category, tracks, basket, grad }>} catalogue modules by code
 */
export function buildChecklist(plan, catalogue) {
  const nowIdx = plan.semesters.findIndex((s) => s.id === plan.currentSem)
  const placed = placedModules(plan, catalogue)
  const { urgencyOf, recFor, chipFor } = semTools(plan)

  const groups = degreeGroups.map((g) => ({
    key: g.key,
    label: g.label,
    slots: g.slots.map((s) => ({ ...s, match: null })),
  }))
  const allSlots = groups.flatMap((g) => g.slots)

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
        how: s.how ?? null,
        note: s.note ?? null,
      }
      if (s.match) {
        const { mod, semId, status } = s.match
        return { ...base, status, urgency: null, semId, rec: recFor(s.window, semId), chip: chipFor(s.window, semId), detail: `${mod.code} · ${mod.name}` }
      }
      return { ...base, status: 'todo', urgency: urgencyOf(s.window), semId: null, rec: recFor(s.window, null), chip: chipFor(s.window, null), detail: detailFor(s, plan) }
    })
    const count = (st) => slots.filter((s) => s.status === st).length
    return { key: g.key, label: g.label, slots, cleared: count('cleared'), planned: count('planned'), todo: count('todo') }
  })

  const flat = out.flatMap((g) => g.slots)
  const totals = {
    required: TOTAL_COURSES,
    cleared: flat.filter((s) => s.status === 'cleared').length,
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
    const best = hits.find((p) => p.status === 'cleared') ?? hits[0]
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
      chip: chipFor(ANY_TERM, best?.semId ?? null),
    }
  })

  const abroad = plan.semesters.findIndex((s) => s.exchange)
  const exposure = {
    id: 'exposure',
    label: globalExposure.label,
    rule: 'exposure',
    detail: globalExposure.detail,
    status: abroad === -1 ? 'todo' : abroad < nowIdx ? 'cleared' : 'planned',
    urgency: abroad === -1 ? urgencyOf(globalExposure.window) : null,
    semId: abroad === -1 ? null : plan.semesters[abroad].id,
  }
  exposure.rec = recFor(globalExposure.window, exposure.semId)
  exposure.chip = chipFor(globalExposure.window, exposure.semId)

  return { groups: out, totals, other: [exposure, ...grad] }
}

/**
 * The modules a student could pick for a checklist item, each with where it already sits in the plan (or null).
 * Fixed courses that are not in the catalogue yet come back as a single `stub` entry.
 * TODO(backend): replace with GET /api/modules?basket=... / ?track=... once the catalogue is in the database.
 */
export function candidatesFor(item, plan, catalogue) {
  const where = new Map(placedModules(plan, catalogue).map((p) => [p.mod.code, { status: p.status, semId: p.semId }]))
  const all = Object.values(catalogue)

  let list = []
  if (item.rule === 'codes') {
    list = item.codes.map((c) => catalogue[c]).filter(Boolean)
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
