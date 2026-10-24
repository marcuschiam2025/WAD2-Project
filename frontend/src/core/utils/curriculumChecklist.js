// Live requirement rows. Counts are requirements, while credit progress stays in CU.
const passes = ['all', 'chooseN', 'basket', 'anyFromCategory']
const effectiveCode = entry => entry.split('→').pop().trim()
const matches = (r, m) => ['all', 'chooseN'].includes(r.rule) ? r.modules?.includes(m.code)
  : ['basket', 'flag'].includes(r.rule) ? m.fulfils?.includes(r.tag)
    : r.rule === 'anyFromCategory' && (r.categories?.includes('ANY') || r.categories?.some(c => m.categories?.includes(c)))
export const curriculumCandidates = (item, catalogue) => Object.values(catalogue).filter(m => matches(item.requirement, m))
const sum = rows => rows.reduce((n, p) => n + (p.mod.cu ?? 1), 0)
function met(r, rows) {
  if (r.rule === 'flag') return r.autoFulfilled || rows.length > 0
  if (r.rule === 'all' && !r.modules?.every(c => rows.some(p => p.mod.code === c))) return false
  if (r.rule === 'chooseN' && rows.length < r.n) return false
  return sum(rows) >= r.cuRequired
}

export function buildCurriculumChecklist(plan, catalogue, bundle, { exempted = [], freeExempt = 0, markedDone = [] } = {}) {
  if (bundle.majorId !== plan.majorId) throw new Error('Checklist curriculum does not match this plan')
  const now = plan.semesters.findIndex(s => s.id === plan.currentSem)
  const placed = [], seen = new Set()
  const add = (code, semId, status) => {
    if (!catalogue[code] || seen.has(code)) return
    seen.add(code); placed.push({ mod: catalogue[code], semId, status })
  }
  // Exemptions are completed even if a stale placement of the same code remains.
  exempted.forEach(code => add(code, 'Exempt', 'cleared'))
  plan.semesters.forEach((s, i) => {
    s.modules.forEach(entry => {
      const code = effectiveCode(entry)
      if (s.loa && !catalogue[code]?.fulfils?.includes('CORE:INTERNSHIP')) return
      add(code, s.id, i < now ? 'cleared' : i === now ? 'inProgress' : 'planned')
    })
  })
  const sorted = rows => [...rows].sort((a, b) => (a.level === 'core' ? 0 : 1) - (b.level === 'core' ? 0 : 1) || (a.order ?? 0) - (b.order ?? 0))
  const major = sorted(bundle.requirements ?? [])
  const selected = (plan.tracks ?? []).map(code => bundle.tracks?.find(t => t.trackCode === code)).filter(Boolean)
  const main = selected[0]
  const rules = [...major, ...sorted(main?.requirements ?? [])]
  const allocated = new Map(rules.map(r => [r._id, []]))
  const used = new Set()
  for (const pass of passes) {
    // Specific categories precede the any-course overflow, regardless of display order.
    const current = rules.filter(r => r.rule === pass).sort((a, b) => Number(a.categories?.includes('ANY') ?? false) - Number(b.categories?.includes('ANY') ?? false))
    for (const p of [...placed].sort((a, b) => ['cleared', 'inProgress', 'planned'].indexOf(a.status) - ['cleared', 'inProgress', 'planned'].indexOf(b.status))) {
      if (used.has(p.mod.code)) continue
      const r = current.find(r => matches(r, p.mod) && !met(r, allocated.get(r._id)))
      if (r) { allocated.get(r._id).push(p); used.add(p.mod.code) }
    }
  }
  const groups = [], other = []
  function describe(r, taken, extra = false) {
    const done = taken.filter(p => p.status === 'cleared')
    const current = taken.filter(p => p.status !== 'planned')
    const marked = (r.tag === 'CORE:INTERNSHIP' && markedDone.includes('internship')) || (r.tag === 'CORE:GLOBAL_EXPOSURE' && markedDone.includes('exposure'))
    const exchangeIndex = r.tag === 'CORE:GLOBAL_EXPOSURE' ? plan.semesters.findIndex(s => s.exchange) : -1
    const freeCredit = r.rule === 'anyFromCategory' && r.categories?.includes('ANY') ? Math.max(0, Number(freeExempt) || 0) : 0
    const satisfies = rows => met(r, rows) || (freeCredit > 0 && sum(rows) + freeCredit >= r.cuRequired)
    let status = marked || satisfies(done) ? 'cleared' : satisfies(current) ? 'inProgress' : satisfies(taken) ? 'planned' : 'todo'
    if (!marked && exchangeIndex >= 0) status = exchangeIndex < now ? 'cleared' : exchangeIndex === now ? 'inProgress' : 'planned'
    const semId = status === 'cleared' ? null : taken.at(-1)?.semId ?? null
    const progress = r.rule === 'flag' ? (status === 'todo' ? 'Not yet fulfilled' : 'Fulfilled or included in your plan') : `${sum(taken) + freeCredit} / ${r.cuRequired} CU included${r.rule === 'chooseN' ? ` · ${taken.length} / ${r.n} courses` : ''}`
    return { manualDoneId: r.tag === 'CORE:INTERNSHIP' ? 'internship' : r.tag === 'CORE:GLOBAL_EXPOSURE' ? 'exposure' : null, id: r._id, label: r.label, rule: 'curriculum', requirement: r, status, urgency: null, semId,
      detail: `${marked ? 'Marked as done' : progress}${taken.length ? ` · ${taken.map(p => p.mod.code).join(', ')}` : ''}${extra ? ' · Additional track; courses may also count elsewhere' : ''}`,
      rec: null,
      chip: { text: status === 'todo' ? (taken.length ? 'Partial' : 'Incomplete') : { cleared: 'Cleared', inProgress: 'In progress', planned: 'Planned' }[status], tone: status === 'todo' ? 'neutral' : status === 'inProgress' ? 'inProgress' : 'planned' } }
  }
  function append(r, row, track) {
    if (r.rule === 'flag') { other.push(row); return }
    const key = track ? `track-${track.trackCode}` : `${r.level}-${r.heading ?? ''}`
    let group = groups.find(g => g.key === key)
    if (!group) { group = { key, label: track ? track.name : `${r.level === 'core' ? 'University Core' : 'Major'}${r.heading ? ` · ${r.heading}` : ''}`, slots: [] }; groups.push(group) }
    group.slots.push(row)
  }
  for (const r of rules) append(r, describe(r, r.rule === 'flag' ? placed.filter(p => matches(r, p.mod)) : allocated.get(r._id)), r.level === 'track' ? main : null)
  for (const track of selected.slice(1)) for (const r of sorted(track.requirements ?? [])) append(r, describe(r, placed.filter(p => matches(r, p.mod)), true), track)
  for (const g of groups) for (const status of ['cleared', 'inProgress', 'planned', 'todo']) g[status] = g.slots.filter(s => s.status === status).length
  const flat = [...groups.flatMap(g => g.slots), ...other]
  const totals = { required: flat.length, late: 0 }
  for (const status of ['cleared', 'inProgress', 'planned', 'todo']) totals[status] = flat.filter(s => s.status === status).length
  return { groups, other, totals, live: true }
}
