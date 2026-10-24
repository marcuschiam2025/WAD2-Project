import { acceptHMRUpdate, defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { api } from '../services/api'
import { liveModules } from '../data/catalogue'
import { degreeGroups } from '../data/degree'

// Catalogue tags -> the basket and graduation keys the degree checklist uses
const BASKET_OF = { 'CORE:MANAGING': 'managing', 'CORE:TECH_SCIENCE_SOCIETY': 'tss', 'CORE:CULTURES_MODERN_WORLD': 'cmw' }
const GRAD_OF = { 'GRAD:SUSTAINABILITY': 'sustainability', 'GRAD:SG_ASIA_STUDIES': 'sg-asia' }
const IS_CATEGORIES = ['IS', 'IS_TRACK', 'IS_RELATED']
// Courses the checklist names one by one (IS114, IS212, ...): they are major core, not IS electives
const FIXED_CODES = new Set(degreeGroups.flatMap((g) => g.slots).flatMap((s) => s.codes ?? []))

// The backend's module and major catalogue. Loaded once; while the backend is unreachable,
// liveModules stays empty and everything falls back to the sample catalogue in core/data.
export const useCatalogueStore = defineStore('catalogue', () => {
  const online = ref(false)
  const majors = ref([])
  const details = reactive({}) // code -> GET /api/modules/:code (the list leaves descriptions out)
  const curricula = reactive({}) // curriculum id -> complete backend requirement bundle
  const trackRequirementsFor = majorId => curricula[majorId]?.trackRequirements ?? {}
  const loadedMajors = new Set()
  let loading = null

  function load() {
    loading ??= Promise.all([api.modules({ includeArchived: true }), api.majors()])
      .then(([mods, majorList]) => {
        mods.forEach((m) => (liveModules[m._id] = m))
        majors.value = majorList
        online.value = true
      })
      .catch(() => {
        loading = null // try again next time
      })
    return loading
  }

  // The catalogue id of a major from its name (e.g. 'Information Systems' -> 'BSC-IS_AY2025'):
  // the newest curriculum that has graduation requirements, or the newest one at all
  function majorIdFor(name) {
    const matching = majors.value.filter((m) => m.name === name).sort((a, b) => b.intakeFrom - a.intakeFrom)
    return (matching.find((m) => m.requirementsAvailable) ?? matching[0])?._id ?? null
  }

  // The track course lists of a major, from GET /api/majors/:id/requirements
  async function loadMajor(majorId) {
    if (!majorId || loadedMajors.has(majorId)) return
    loadedMajors.add(majorId)
    try {
      const bundle = await api.majorRequirements(majorId)
      const { tracks } = bundle
      const lists = {}
      const reqs = {}
      tracks.forEach((t) => {
        lists[t.trackCode] = [...new Set(t.requirements.flatMap((r) => r.modules ?? []))]
        reqs[t.trackCode] = {
          name: t.name,
          reqs: [...t.requirements]
            // the compulsory course first, then the list to pick from
            .sort((a, b) => /compulsory/i.test(b.label) - /compulsory/i.test(a.label) || (a.order ?? 0) - (b.order ?? 0))
            .map((r) => ({ id: r._id, label: r.label, codes: r.modules ?? [], count: r.rule === 'all' ? (r.modules ?? []).length : (r.n ?? r.cuRequired ?? 1) })),
        }
      })
      curricula[majorId] = { ...bundle, trackModules: lists, trackRequirements: reqs }
    } catch {
      loadedMajors.delete(majorId)
    }
  }

  // The backend catalogue in the shape the degree checklist matches against (see utils/degreeChecklist.js):
  //   category  track (in a track's list) | depth (another IS / IS related course) | major-core | free
  //   basket    managing | tss | cmw (university core baskets)      grad  sustainability | sg-asia
  // The catalogue fields (fulfils, categories, prerequisites, ...) come along for the module details.
  function checklistModulesFor(majorId) {
    const tracksOf = {}
    Object.entries(curricula[majorId]?.trackModules ?? {}).forEach(([track, codes]) => codes.forEach((c) => (tracksOf[c] ??= []).push(track)))
    const out = {}
    Object.values(liveModules).forEach((m) => {
      const tracks = tracksOf[m._id] ?? []
      const fulfils = m.fulfils ?? []
      let category = 'free'
      if (FIXED_CODES.has(m._id)) category = 'major-core'
      else if (tracks.length) category = 'track'
      else if (m.categories?.some((c) => IS_CATEGORIES.includes(c))) category = 'depth'
      out[m._id] = {
        code: m._id,
        name: m.title,
        cu: m.cu ?? 1,
        live: true,
        archived: m.archived === true,
        category,
        tracks,
        basket: fulfils.map((t) => BASKET_OF[t]).find(Boolean),
        grad: fulfils.map((t) => GRAD_OF[t]).filter(Boolean),
        fulfils,
        categories: m.categories ?? [],
        prerequisites: m.prerequisites ?? [],
        corequisites: m.corequisites ?? [],
        termsOffered: m.termsOffered ?? [],
      }
    })
    return out
  }

  async function loadDetail(code) {
    if (details[code] || !online.value) return
    try {
      details[code] = await api.module(code)
    } catch {
      // not in the catalogue: the screens show what they have
    }
  }

  // Module search for the What-If Planner: code or title, like GET /api/modules?q=
  async function search(q, limit = 8) {
    const mods = await api.modules({ q, limit })
    mods.forEach((m) => (liveModules[m._id] ??= m))
    return mods.map((m) => ({ code: m._id, name: m.title }))
  }

  return { online, majors, details, curricula, trackRequirementsFor, checklistModulesFor, load, loadMajor, loadDetail, majorIdFor, search }
})

// Dev only: lets Vite swap this store's code in when the file is edited, instead of keeping the old store
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useCatalogueStore, import.meta.hot))
