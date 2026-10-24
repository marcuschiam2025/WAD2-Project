import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { modules, liveModules, requirementBuckets } from '../data/catalogue'
import { api } from '../services/api'
import { buildChecklist } from '../utils/degreeChecklist'
import { useCatalogueStore } from './catalogue'
import { useRoomsStore } from './rooms'
import { useUserStore } from './user'

export const MAX_PLANS = 3
export const MAX_MODULES_PER_SEM = 6

// A semester has room for a module if it already holds it (a move) or is under the maximum
export const hasRoom = (sem, code) => sem.modules.includes(code) || sem.modules.length < MAX_MODULES_PER_SEM

// Exchange chips look like "CS412 → IS460"; the mapped SMU code is on the right.
export function effectiveCode(entry) {
  return entry.split('→').pop().trim()
}

// Plans from GET /api/plans, in the shape the planner screens use (the backend's _id becomes id)
function fromApi(p) {
  return {
    id: p._id,
    name: p.name,
    majorId: p.majorId,
    tracks: [...p.tracks],
    currentSem: p.currentSem,
    semesters: p.semesters.map((s) => ({ id: s.id, label: s.label, exchange: !!s.exchange, loa: !!s.loa, modules: [...s.modules] })),
  }
}

// The fields PUT /api/plans/:id accepts
function toApi(p) {
  return {
    name: p.name,
    tracks: p.tracks,
    currentSem: p.currentSem,
    semesters: p.semesters.map(({ id, label, exchange, loa, modules: mods }) => ({ id, label, exchange, loa, modules: mods })),
  }
}

// Track codes saved before the catalogue used the backend's codes
const trackCode = (code) => (code === 'SMT' ? 'SMCT' : code)

function sem(id, mods, extra = {}) {
  const [y, s] = id.match(/\d/g)
  return { id, label: `Y${y} · S${s}`, exchange: false, loa: false, modules: mods, ...extra }
}

export const usePlannerStore = defineStore('planner', () => {
  const plans = ref([])
  const activePlanId = ref(null)
  const basket = ref([])
  const emptyPlan = { id: null, name: '', tracks: [], currentSem: 'Y1S1', semesters: [] }
  const activePlan = computed(() => plans.value.find(p => p.id === activePlanId.value) ?? plans.value[0] ?? emptyPlan)

  // --- Backend sync ------------------------------------------------------------------------
  // Plans are loaded for the authenticated account and edits are saved with PUT.
  const user = useUserStore()
  const catalogue = useCatalogueStore()
  const online = ref(false)
  const syncError = ref('')
  const checks = ref({}) // plan id -> GET /api/plans/:id/check result
  const lastSaved = new Map() // plan id -> the body last sent (or loaded), so unchanged plans aren't re-sent
  let loading = null
  let session = 0
  const basketSaving = ref(false)
  const basketError = ref('')
  let savedBasket = '[]'
  let basketRequest = null

  // Serialize snapshots: a slower earlier request must not overwrite a newer edit.
  function saveBasket() {
    if (basketRequest) return basketRequest
    if (!online.value || !user.isSignedIn) {
      basketError.value = 'Connect to the server before saving your basket.'
      return Promise.reject(new Error(basketError.value))
    }
    const version = session
    basketSaving.value = true
    basketError.value = ''
    const request = Promise.resolve().then(async () => {
      try {
        while (version === session && online.value) {
          const snapshot = JSON.stringify(basket.value)
          if (snapshot === savedBasket) break
          const data = await api.updateMe({ basket: JSON.parse(snapshot) })
          if (version !== session) return
          savedBasket = snapshot
          user.profile.basket = [...data.basket]
        }
      } catch (error) {
        if (version !== session) return
        savedBasket = null // The server may have committed before a network failure.
        basketError.value = error.message
        throw error
      } finally {
        if (basketRequest === request) {
          basketRequest = null
          basketSaving.value = false
        }
      }
    })
    basketRequest = request
    return request
  }
  watch(basket, () => {
    if (online.value) saveBasket().catch(() => {})
  }, { deep: true, flush: 'sync' })

  // A new student's first plan: their major, tracks, current semester and the modules from onboarding
  function firstPlan() {
    const p = user.profile
    const majorId = catalogue.majorIdFor(p.major)
    const semesters = []
    for (let y = 1; y <= 4; y++) {
      for (let s = 1; s <= 2; s++) {
        const id = `Y${y}S${s}`
        semesters.push(sem(id, [...(p.takenBySem?.[id] ?? [])]))
      }
    }
    return {
      majorId,
      tracks: majorId ? (p.tracks ?? []).map(trackCode).slice(0, 2) : [],
      currentSem: p.currentSem ?? `Y${p.year ?? 1}S1`,
      semesters,
    }
  }

  function remember(plan) {
    lastSaved.set(plan.id, JSON.stringify(toApi(plan)))
  }

  async function refreshCheck(id) {
    const version = session
    try {
      const check = await api.checkPlan(id)
      if (version !== session) return
      checks.value[id] = check
    } catch {
      if (version !== session) return
      delete checks.value[id] // no major / no requirements yet: the screens use the local overview
    }
  }

  // Load the student's plans, creating the first one if they have none. Safe to call more than once.
  function load() {
    if (!user.isSignedIn || !user.onboarded) return Promise.resolve()
    const version = session
    loading ??= (async () => {
      await catalogue.load()
      if (version !== session) return
      let list = await api.plans()
      if (version !== session) return
      const isNew = !list.length
      if (isNew) list = [await api.createPlan(firstPlan())]
      if (version !== session) return
      online.value = false
      basket.value = [...(user.profile.basket ?? [])]
      savedBasket = JSON.stringify(basket.value)
      if (isNew) user.profile.appliedToPlans = true // firstPlan already used the onboarding answers
      plans.value = list.map(fromApi)
      plans.value.forEach(remember)
      activePlanId.value = plans.value[0].id
      online.value = true
      syncError.value = ''
      placeDecided()
      plans.value.forEach((p) => {
        refreshCheck(p.id)
        catalogue.loadMajor(p.majorId)
      })
    })().catch((e) => {
      if (version !== session) return
      loading = null
      syncError.value = e.message
    })
    return loading
  }

  // Onboarding answers -> the student's existing plans (a brand-new student's first plan is built from them
  // in firstPlan instead). Completed semesters and the current one get the modules entered in onboarding, the
  // current semester and tracks are updated, and future semesters keep their modules minus any now marked as taken.
  function applyOnboarding(plan) {
    const p = user.profile
    const taken = p.takenBySem ?? {}
    const takenCodes = new Set(Object.values(taken).flat())
    if (p.currentSem && plan.semesters.some((s) => s.id === p.currentSem)) plan.currentSem = p.currentSem
    const now = semIndex(plan, plan.currentSem)
    plan.semesters.forEach((s, i) => {
      s.modules = i <= now ? [...(taken[s.id] ?? [])] : s.modules.filter((m) => !takenCodes.has(effectiveCode(m)))
    })
    if (plan.majorId) plan.tracks = (p.tracks ?? []).map(trackCode).slice(0, 2)
  }
  watch(
    () => online.value && user.onboarded && user.profile.appliedToPlans === false,
    (pending) => {
      if (!pending) return
      plans.value.forEach(applyOnboarding) // the deep watch on plans saves them
      user.profile.appliedToPlans = true
    },
    { immediate: true },
  )

  // Throw away unsaved edits and load the plans as the backend has them
  function reload() {
    loading = null
    return load()
  }

  // Save edited plans, half a second after the last change
  let saveTimer
  async function flush() {
    const version = session
    if (!online.value) return
    for (const plan of plans.value) {
      if (version !== session) return
      const body = JSON.stringify(toApi(plan))
      if (lastSaved.get(plan.id) === body) continue
      lastSaved.set(plan.id, body)
      try {
        await api.updatePlan(plan.id, toApi(plan))
        if (version !== session) return
        syncError.value = ''
        refreshCheck(plan.id)
      } catch (e) {
        if (version !== session) return
        lastSaved.delete(plan.id)
        syncError.value = e.message
      }
    }
  }
  watch(
    plans,
    () => {
      if (!online.value) return
      clearTimeout(saveTimer)
      saveTimer = setTimeout(flush, 500)
    },
    { deep: true },
  )

  function semIndex(plan, semId) {
    return plan.semesters.findIndex((s) => s.id === semId)
  }

  function semStatus(plan, semId) {
    const i = semIndex(plan, semId)
    const now = semIndex(plan, plan.currentSem)
    if (i < now) return 'done'
    if (i === now) return 'now'
    return 'future'
  }

  // Requisites as AND-of-OR groups: [['IS111', 'CS101'], ['IS217']] = (IS111 or CS101) and IS217.
  // From the backend catalogue when it is loaded, otherwise from the sample catalogue.
  function requisites(code) {
    const live = liveModules[code]
    if (live) return { prereqs: live.prerequisites ?? [], coreqs: live.corequisites ?? [] }
    const mod = modules[code]
    return { prereqs: (mod?.prereqs ?? []).map((c) => [c]), coreqs: (mod?.coreqs ?? []).map((c) => [c]) }
  }

  // The module to suggest for an unmet group: one in the basket, then one the app knows, else the first
  const suggestFrom = (group) =>
    group.find((c) => basket.value.includes(c)) ?? group.find((c) => modules[c]) ?? group[0]

  // Prereqs must sit in an earlier semester; coreqs in the same semester or a completed one.
  // Returns one suggested module per unmet group.
  function checkModule(plan, code, semId) {
    const { prereqs: pre, coreqs: co } = requisites(effectiveCode(code))
    const target = semIndex(plan, semId)
    const now = semIndex(plan, plan.currentSem)
    const placedAt = (c) =>
      plan.semesters.findIndex((s) => s.modules.some((m) => effectiveCode(m) === c))
    const exempt = user.profile.exempted ?? []
    const prereqMet = (c) => {
      if (exempt.includes(c)) return true
      const at = placedAt(c)
      return at !== -1 && at < target
    }
    const coreqMet = (c) => {
      if (exempt.includes(c)) return true
      const at = placedAt(c)
      return at === target || (at !== -1 && at < now)
    }
    const prereqs = pre.filter((g) => !g.some(prereqMet)).map(suggestFrom)
    const coreqs = co.filter((g) => !g.some(coreqMet)).map(suggestFrom)
    return { prereqs, coreqs }
  }

  function hasWarning(plan, code, semId) {
    if (semStatus(plan, semId) === 'done') return false
    const { prereqs, coreqs } = checkModule(plan, code, semId)
    return prereqs.length > 0 || coreqs.length > 0
  }

  function removeEverywhere(plan, code) {
    plan.semesters.forEach((s) => {
      s.modules = s.modules.filter((m) => m !== code)
    })
    basket.value = basket.value.filter((m) => m !== code)
  }

  // Returns false (and changes nothing) when the semester already holds the maximum number of modules
  function placeModule(code, semId) {
    const plan = activePlan.value
    const sem = plan.semesters[semIndex(plan, semId)]
    if (!hasRoom(sem, code)) return false
    removeEverywhere(plan, code)
    sem.modules.push(code)
    return true
  }

  function returnToBasket(code) {
    removeEverywhere(activePlan.value, code)
    basket.value.push(code)
  }

  function addToBasket(code) {
    if (!basket.value.includes(code)) basket.value.push(code)
  }

  function removeFromBasket(code) {
    basket.value = basket.value.filter((m) => m !== code)
  }

  // Empties the basket, except modules a collab room decided on. Returns the removed codes (for undo).
  function clearBasket() {
    const keep = new Set(rooms.decided.map((d) => d.module))
    const removed = basket.value.filter((m) => !keep.has(m))
    basket.value = basket.value.filter((m) => keep.has(m))
    return removed
  }

  // Modules accepted in collab rooms are placed in the next semester of every plan (the one being bid for),
  // unless a plan already has them somewhere. Undoing the accept takes them out again, as long as they are still
  // where they were placed. A plan with no biddable next semester (or a full one) gets the module in the basket instead.
  const rooms = useRoomsStore()
  const placedByRoom = new Map() // "planId|code" -> the semester it was placed in
  const basketFromRoom = new Set()
  const inPlan = (plan, code) => plan.semesters.some((s) => s.modules.some((m) => effectiveCode(m) === code))
  function placeFromRoom(code) {
    let needsBasket = false
    plans.value.forEach((plan) => {
      if (inPlan(plan, code)) return
      const next = plan.semesters[semIndex(plan, plan.currentSem) + 1]
      if (next && !next.exchange && !next.loa && hasRoom(next, code)) {
        next.modules.push(code)
        placedByRoom.set(`${plan.id}|${code}`, next.id)
      } else needsBasket = true
    })
    if (needsBasket && !basket.value.includes(code)) {
      basketFromRoom.add(code)
      basket.value.push(code)
    } else if (!needsBasket) removeFromBasket(code)
  }
  // After the plans are (re)loaded from the backend, place what the rooms have already decided
  function placeDecided() {
    placedByRoom.clear()
    rooms.decided.forEach((d) => placeFromRoom(d.module))
  }
  watch(
    () => rooms.decided.map((d) => d.module),
    (now, before = []) => {
      now.filter((code) => !before.includes(code)).forEach(placeFromRoom)
      before
        .filter((code) => !now.includes(code))
        .forEach((code) => {
          plans.value.forEach((plan) => {
            const key = `${plan.id}|${code}`
            const semId = placedByRoom.get(key)
            if (!semId) return
            placedByRoom.delete(key)
            const sem = plan.semesters.find((x) => x.id === semId)
            if (sem) sem.modules = sem.modules.filter((m) => m !== code)
          })
          if (basketFromRoom.delete(code)) removeFromBasket(code)
        })
    },
    { immediate: true },
  )

  watch(() => user.uid, () => {
    session++
    clearTimeout(saveTimer)
    online.value = false
    loading = null
    lastSaved.clear()
    checks.value = {}
    plans.value = []
    activePlanId.value = null
    basket.value = []
    savedBasket = '[]'
    basketRequest = null
    basketSaving.value = false
    basketError.value = ''
    placedByRoom.clear()
    basketFromRoom.clear()
    syncError.value = ''
  }, { flush: 'sync' })

  function nextSemId(plan) {
    const last = plan.semesters.at(-1).id.match(/\d/g).map(Number)
    return last[1] === 1 ? `Y${last[0]}S2` : `Y${last[0] + 1}S1`
  }

  function addSemester({ loa = false } = {}) {
    const plan = activePlan.value
    plan.semesters.push(sem(nextSemId(plan), [], { loa }))
  }

  function toggleExchange(semId) {
    const s = activePlan.value.semesters.find((x) => x.id === semId)
    s.exchange = !s.exchange
  }

  // Online, a new plan keeps the active plan's major, tracks and completed semesters;
  // the semesters from the current one onwards start empty.
  function addPlan() {
    if (plans.value.length >= MAX_PLANS) return false
    if (!online.value) return false
    const version = session
    const from = activePlan.value
    const now = semIndex(from, from.currentSem)
    api
      .createPlan({
        majorId: from.majorId,
        tracks: [...from.tracks],
        currentSem: from.currentSem,
        semesters: toApi(from).semesters.map((s, i) => ({ ...s, modules: i < now ? [...s.modules] : [] })),
      })
      .then((created) => {
        if (version !== session) return
        const plan = fromApi(created)
        remember(plan)
        plans.value.push(plan)
        activePlanId.value = plan.id
        refreshCheck(plan.id)
      })
      .catch((e) => (syncError.value = e.message))
    return true
  }

  function deletePlan(id) {
    if (plans.value.length <= 1) return
    plans.value = plans.value.filter((p) => p.id !== id)
    plans.value.forEach((p, i) => (p.name = `Plan ${i + 1}`))
    activePlanId.value = plans.value[0].id
    if (!online.value) return
    // The backend renumbers the rest the same way, so the names match without another save
    lastSaved.delete(id)
    delete checks.value[id]
    plans.value.forEach(remember)
    api.deletePlan(id).catch((e) => (syncError.value = e.message))
  }

  // Requirement overview: every placed module sorted into a bucket.
  // Track modules beyond the 4 needed overflow to IS Depth (single track) or Free Electives.
  const requirements = computed(() => {
    const plan = activePlan.value
    const buckets = Object.fromEntries(requirementBuckets.map((b) => [b.key, []]))
    const placed = plan.semesters.flatMap((s) => s.modules.map(effectiveCode))
    const firstTrack = plan.tracks[0]
    let trackCount = 0
    placed.forEach((code) => {
      const mod = modules[code]
      if (!mod) return
      if (mod.category === 'track') {
        if (mod.tracks?.includes(firstTrack) && trackCount < 4) {
          trackCount++
          buckets.track.push(mod)
        } else if (mod.tracks?.includes(firstTrack) && plan.tracks.length === 1) {
          buckets.depth.push(mod)
        } else {
          buckets.free.push(mod)
        }
      } else {
        buckets[mod.category].push(mod)
      }
    })
    return requirementBuckets.map((b) => ({ ...b, modules: buckets[b.key], planned: buckets[b.key].length }))
  })

  const plannedCu = computed(() => requirements.value.reduce((a, b) => a + Math.min(b.planned, b.required), 0))
  const requiredCu = computed(() => requirementBuckets.reduce((a, b) => a + b.required, 0))
  // The backend's requirement check for the active plan (null offline, or when the plan has no major)
  const activeCheck = computed(() => checks.value[activePlan.value.id] ?? null)

  // Outstanding Modules: the 36 courses of the course progression (data/degree.js), matched against the backend's
  // module catalogue (its tags, e.g. CORE:NUMERACY, and the track course lists) when it is loaded, else the sample one
  const checklistCatalogue = computed(() => (catalogue.online ? catalogue.checklistModules : modules))
  const exempted = computed(() => user.profile.exempted ?? [])
  const checklist = computed(() =>
    buildChecklist(activePlan.value, checklistCatalogue.value, {
      exempted: exempted.value,
      freeExempt: user.profile.freeExemptions ?? 0,
      markedDone: user.profile.markedDone ?? [],
      trackReqs: catalogue.online ? catalogue.trackRequirements : null, // each track's compulsory course + list
    }),
  )

  const hasAnyWarning = computed(() => {
    const plan = activePlan.value
    return plan.semesters.some((s) => s.modules.some((m) => hasWarning(plan, m, s.id)))
  })

  return {
    plans,
    activePlanId,
    activePlan,
    online,
    syncError,
    activeCheck,
    checklist,
    checklistCatalogue,
    exempted,
    load,
    reload,
    basket,
    basketSaving,
    basketError,
    saveBasket,
    requirements,
    plannedCu,
    requiredCu,
    hasAnyWarning,
    semIndex,
    semStatus,
    checkModule,
    hasWarning,
    placeModule,
    returnToBasket,
    addToBasket,
    removeFromBasket,
    clearBasket,
    addSemester,
    toggleExchange,
    addPlan,
    deletePlan,
  }
})

// Dev only: lets Vite swap this store's code in when the file is edited, instead of keeping the old store
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(usePlannerStore, import.meta.hot))
