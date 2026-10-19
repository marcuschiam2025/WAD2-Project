// Requirement + prerequisite checker for a What-If plan. Pure function — unit test me.

export const REQUIREMENT_BUCKETS = [
  { key: 'uni-core', label: 'University Core', required: 6 },
  { key: 'major-core', label: 'IS Major Core', required: 10 },
  { key: 'track', label: 'IS Track #1', required: 4 },
  { key: 'depth', label: 'IS Depth', required: 2 },
  { key: 'free', label: 'Free Electives', required: 6 },
]

// Exchange mappings are stored as "CS412 → IS460"; the SMU code is on the right.
export const effectiveCode = (entry) => entry.split('→').pop().trim()

/**
 * @param {{ tracks: string[], currentSem: string, semesters: Array<{ id, loa, modules: string[] }> }} plan
 * @param {Record<string, { code, cu, category, tracks, prereqs, coreqs }>} catalogue modules by code
 */
export function checkPlan(plan, catalogue) {
  const semesters = plan.semesters.filter((s) => !s.loa)
  const now = semesters.findIndex((s) => s.id === plan.currentSem)
  const placedAt = (code) => semesters.findIndex((s) => s.modules.some((m) => effectiveCode(m) === code))

  // Prereqs must be in an earlier semester; coreqs in the same semester or an already-completed one.
  const warnings = []
  semesters.forEach((sem, i) => {
    if (i < now) return
    sem.modules.forEach((entry) => {
      const mod = catalogue[effectiveCode(entry)]
      if (!mod) return
      const prereqs = (mod.prereqs ?? []).filter((p) => {
        const at = placedAt(p)
        return at === -1 || at >= i
      })
      const coreqs = (mod.coreqs ?? []).filter((c) => {
        const at = placedAt(c)
        return !(at === i || (at !== -1 && at < now))
      })
      if (prereqs.length || coreqs.length) warnings.push({ module: mod.code, semester: sem.id, prereqs, coreqs })
    })
  })

  // Sort placed modules into buckets; track modules beyond 4 overflow to depth (single track) or free.
  const buckets = Object.fromEntries(REQUIREMENT_BUCKETS.map((b) => [b.key, []]))
  let trackCount = 0
  semesters
    .flatMap((s) => s.modules.map(effectiveCode))
    .forEach((code) => {
      const mod = catalogue[code]
      if (!mod) return
      if (mod.category !== 'track') return buckets[mod.category].push(mod)
      const inFirstTrack = mod.tracks?.includes(plan.tracks[0])
      if (inFirstTrack && trackCount < 4) {
        trackCount++
        buckets.track.push(mod)
      } else if (inFirstTrack && plan.tracks.length === 1) buckets.depth.push(mod)
      else buckets.free.push(mod)
    })

  const requirements = REQUIREMENT_BUCKETS.map((b) => {
    const planned = buckets[b.key].reduce((sum, m) => sum + (m.cu ?? 1), 0)
    return { ...b, planned, met: planned >= b.required, modules: buckets[b.key].map((m) => m.code) }
  })

  return {
    requirements,
    warnings,
    plannedCu: requirements.reduce((a, r) => a + Math.min(r.planned, r.required), 0),
    requiredCu: REQUIREMENT_BUCKETS.reduce((a, b) => a + b.required, 0),
    onTrack: warnings.length === 0,
  }
}
