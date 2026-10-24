import { readFile } from 'node:fs/promises'
import Track from '../../planning/models/Track.js'
import Requirement from '../../planning/models/Requirement.js'
import Module from '../../planning/models/Module.js'
import { unmetGroups } from '../../planning/utils/requisites.js'

// Editorial tags enrich known courses only; titles, membership and requisites
// always come from the shared database, never this historical shortlist.
const editorial = JSON.parse(await readFile(new URL('../content/modules.ay2025.json', import.meta.url), 'utf8'))
const codeFor = (track) => track === 'SMT' ? 'SMCT' : track
const quizCode = (track) => track === 'SMCT' ? 'SMT' : track
const sourceUrl = editorial.sourceUrl

export function createSharedCatalogueLoader({
  tracks = (filter) => Track.find(filter).lean(),
  requirements = (filter) => Requirement.find(filter).sort({ order: 1, _id: 1 }).lean(),
  modules = (filter) => Module.find(filter).lean(),
} = {}) {
  return async (attempt, { completedModules = [], intakeYear } = {}) => {
    const base = {
      catalogueVersion: 'shared-mongodb-BSC-IS_AY2025', catalogueSource: 'mongodb',
      intakeFrom: 2025, sourceUrl, eligibilityStatus: 'partial-check', modules: [],
    }
    if (Number.isInteger(intakeYear) && intakeYear < 2025) return base
    const top = attempt.results.slice(0, 2).map(({ track }) => codeFor(track))
    const foundTracks = await tracks({ majorId: 'BSC-IS_AY2025', trackCode: { $in: top } })
    const rules = await requirements({ ownerId: { $in: foundTracks.map((t) => t._id) }, level: 'track' })
    const codes = [...new Set(rules.flatMap((r) => r.modules ?? []))]
    const foundModules = codes.length ? await modules({ _id: { $in: codes } }) : []
    const byCode = new Map(foundModules.map((m) => [m._id, m]))
    const done = new Set(completedModules.map((c) => c.trim().toUpperCase()))
    const membership = (code) => foundTracks.filter((t) => rules.some((r) => r.ownerId === t._id && r.modules?.includes(code))).map((t) => quizCode(t.trackCode))
    const candidates = codes.map((code) => byCode.get(code)).filter(Boolean).filter((m) =>
      !m.archived && !done.has(m._id) && unmetGroups(m.prerequisites, (c) => done.has(c)).length === 0 &&
      !(m.mutuallyExclusive ?? []).some((c) => done.has(c)),
    ).map((m) => {
      const tags = editorial.modules.find((item) => item.code === m._id)?.themeTags ?? []
      const manual = (m.corequisites?.length ?? 0) > 0 || (m.prerequisiteRules?.length ?? 0) > 0 || (m.requisiteNotes?.length ?? 0) > 0
      return {
        code: m._id, name: m.title, summary: m.description ? m.description.split(/(?<=[.!?])\s/)[0] : 'Explore this course in the shared module catalogue.',
        tracks: membership(m._id), themeTags: tags, sourceUrl,
        prerequisiteStatus: manual ? 'manual-review' : 'recorded-prerequisites-met',
        offeringStatus: 'unverified',
      }
    })
    return {
      ...base, catalogueStatus: foundTracks.length === top.length && codes.every((code) => byCode.has(code)) ? 'available' : 'unavailable',
      modules: candidates,
    }
  }
}
export const loadSharedCatalogueV2 = createSharedCatalogueLoader()
