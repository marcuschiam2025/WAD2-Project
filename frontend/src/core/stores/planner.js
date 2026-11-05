import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { liveModules } from '../data/catalogue'
import { api } from '../services/api'
import { buildCurriculumChecklist, effectiveCode } from '../utils/curriculumChecklist'
import { layoutCurriculum } from '../utils/curriculumLayout'
import { useCatalogueStore } from './catalogue'
import { useRoomsStore } from './rooms'
import { useUserStore } from './user'

export const MAX_PLANS = 3
export const MAX_LOA_TERMS = 2
export const INTERNSHIP_CODE = 'COR1001'
export const MAX_MODULES_PER_SEM = 6

// A semester has room for a module if it already holds it (a move) or is under the maximum
export const hasRoom = (sem, code) => sem.modules.includes(code) || sem.modules.length < MAX_MODULES_PER_SEM

export { effectiveCode }

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
  const planActionPending = ref(false)
  const planActionError = ref('')
  let deletionRequest = null
  let deletingOnServer = false
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
          if (!Array.isArray(data?.basket)) throw new Error('The server did not save your basket.')
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
    const majorId = catalogue.majorIdFor(p.major, p.intakeYear)
    const semesters = []
    const loa = p.loaSemesters ?? []
    for (let i = 0; i < 8 + loa.length; i++) {
      const id = `Y${Math.floor(i / 2) + 1}S${i % 2 + 1}`
      semesters.push(sem(id, [...(p.takenBySem?.[id] ?? [])], { loa: loa.includes(id) }))
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
    const plan = plans.value.find(p => p.id === id)
    if (!plan?.majorId || catalogue.majors.find(m => m._id === plan.majorId)?.requirementsAvailable === false) {
      delete checks.value[id]
      return
    }
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
      if (isNew && !catalogue.online) throw new Error('Could not load the curriculum catalogue. Retry before creating your first plan.')
      if (isNew) list = [await api.createPlan(firstPlan())]
      if (version !== session) return
      // Repair only missing curricula; never replace a plan's saved intake or semester choices.
      const majorId = catalogue.online ? catalogue.majorIdFor(user.profile.major, user.profile.intakeYear) : null
      if (majorId) {
        for (let i = 0; i < list.length; i++) {
          if (list[i].majorId) continue
          list[i] = await api.updatePlan(list[i]._id, { majorId })
          if (version !== session) return
        }
      }
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
  // in firstPlan instead). Modules entered on the form go into their semesters, and only the ones the student took
  // off the form leave the plan: anything added in the planner stays. Tracks follow only if they changed on the form,
  // so a plan's own What-If tracks survive other profile edits.
  function profileLoaError(profile) {
    const loa = profile.loaSemesters ?? []
    for (const plan of plans.value) {
      const past = s => s.id < profile.currentSem
      const count = plan.semesters.filter(s => past(s) ? loa.includes(s.id) : s.loa).length
      if (count > MAX_LOA_TERMS) return `${plan.name} would exceed ${MAX_LOA_TERMS} LOA terms. Remove a future LOA term in that plan before saving your profile.`
      const extra = plan.semesters.filter(s => past(s) && loa.includes(s.id) && !s.loa).length
      const last = plan.semesters.at(-1)?.id
      if (last && (Number(last[1]) - 1) * 2 + Number(last[3]) + extra > 18) return `${plan.name} cannot extend past Y9S2. Remove an unused future semester before saving your profile.`
    }
    return ''
  }

  function applyOnboarding(plan) {
    const p = user.profile
    const before = p.previousDegree ?? {}
    const taken = p.takenBySem ?? {}
    const takenCodes = new Set(Object.values(taken).flat())
    const loa = p.loaSemesters ?? []
    const addedLoa = plan.semesters.filter(s => s.id < p.currentSem && loa.includes(s.id) && !s.loa).length
    if (p.currentSem && plan.semesters.some((s) => s.id === p.currentSem)) plan.currentSem = p.currentSem
    const now = semIndex(plan, plan.currentSem)
    const removed = new Set(Object.entries(before.takenBySem ?? {})
      .filter(([id]) => { const i = semIndex(plan, id); return i >= 0 && i <= now })
      .flatMap(([, codes]) => codes)
      .filter((code) => !takenCodes.has(code)))
    plan.semesters.forEach((s) => {
      const here = taken[s.id] ?? []
      s.modules = s.modules.filter((m) => {
        const code = effectiveCode(m)
        return !removed.has(code) && (!takenCodes.has(code) || here.includes(code))
      })
      here.filter((code) => !s.modules.some((m) => effectiveCode(m) === code)).forEach((code) => s.modules.push(code))
      if (s.id < p.currentSem) {
        s.loa = loa.includes(s.id)
        if (s.loa) {
          s.exchange = false
          const displaced = s.modules.filter(m => effectiveCode(m) !== INTERNSHIP_CODE)
          s.modules = s.modules.filter(m => effectiveCode(m) === INTERNSHIP_CODE)
          displaced.forEach(m => addToBasket(effectiveCode(m)))
        }
      }
    })
    // Keep the regular study terms when a historical term becomes LOA, without shifting planned courses.
    for (let i = 0; i < addedLoa; i++) plan.semesters.push(sem(nextSemId(plan), []))
    const tracks = (p.tracks ?? []).map(trackCode)
    if (plan.majorId && tracks.join() !== (before.tracks ?? []).map(trackCode).join()) {
      // A plan can stay on another curriculum after the intake changes, so keep only the tracks it has
      const available = catalogue.tracksFor(plan.majorId).map((t) => t.code)
      plan.tracks = tracks.filter((code) => available.includes(code)).slice(0, 2)
    }
  }
  watch(
    () => online.value && user.onboarded && user.profile.appliedToPlans === false,
    (pending) => {
      if (!pending) return
      const error = profileLoaError(user.profile)
      if (error) { syncError.value = error; return }
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
  const plansSaving = ref(false)
  let planRequest = null
  function savePlans() {
    clearTimeout(saveTimer)
    if (deletingOnServer) {
      const version = session
      return deletionRequest.then(() => version === session ? savePlans() : undefined)
    }
    if (planRequest) return planRequest
    if (!online.value || !user.isSignedIn) return Promise.reject(new Error('Connect to the server before saving your plans.'))
    const version = session
    plansSaving.value = true
    syncError.value = ''
    const request = Promise.resolve().then(async () => {
      try {
        while (version === session && online.value) {
          const dirty = plans.value.map(plan => ({ id: plan.id, body: JSON.stringify(toApi(plan)) }))
            .filter(plan => lastSaved.get(plan.id) !== plan.body)
          if (!dirty.length) break
          for (const plan of dirty) {
            if (version !== session) return
            try {
              await api.updatePlan(plan.id, JSON.parse(plan.body))
              if (version !== session) return
              lastSaved.set(plan.id, plan.body)
              refreshCheck(plan.id)
            } catch (error) {
              if (version !== session) return
              lastSaved.delete(plan.id)
              throw error
            }
          }
        }
      } catch (error) {
        if (version !== session) return
        syncError.value = error.message
        throw error
      } finally {
        if (planRequest === request) { planRequest = null; plansSaving.value = false }
      }
    })
    planRequest = request
    return request
  }
  watch(
    plans,
    () => {
      if (!online.value) return
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => savePlans().catch(() => {}), 500)
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
  // From the backend catalogue; a module it does not list has none.
  function requisites(code) {
    const live = liveModules[code]
    if (live) return { ...live, prereqs: live.prerequisites ?? [], coreqs: live.corequisites ?? [] }
    return { categories: [], prereqs: [], coreqs: [] }
  }

  // The module to suggest for an unmet group: one in the basket, else the first
  const suggestFrom = (group) =>
    group.find((c) => basket.value.includes(c)) ?? group[0]

  // Match the server's academic checks against the current, possibly unsaved plan.
  // Preserve AND-of-OR groups for explanations, with one suggested course per group for add actions.
  function checkModule(plan, code, semId) {
    code = effectiveCode(code)
    const mod = requisites(code)
    const target = semIndex(plan, semId)
    const exempt = user.profile.exempted ?? []
    const empty = { prereqs: [], coreqs: [], prereqGroups: [], coreqGroups: [], exclusions: [], rules: [] }
    if (target < semIndex(plan, plan.currentSem) || exempt.includes(code)) return empty
    const positions = new Map(exempt.map(c => [c, -1]))
    plan.semesters.forEach((sem, i) => sem.modules.forEach(entry => {
      const placed = effectiveCode(entry)
      if (!exempt.includes(placed)) positions.set(placed, i)
    }))
    const prereqGroups = mod.prereqs.filter(group => !group.some(c => positions.has(c) && positions.get(c) < target))
    const coreqGroups = mod.coreqs.filter(group => !group.some(c => positions.has(c) && positions.get(c) <= target))
    const exclusions = (mod.mutuallyExclusive ?? []).filter(c => positions.has(c))
    const rules = (mod.prerequisiteRules ?? []).filter(rule => {
      const count = [...positions].filter(([c, at]) => at < target && liveModules[c] &&
        (rule.countFrom !== 'TRACK' || requisites(c).categories?.includes('IS_TRACK'))).length
      return count < rule.n
    }).map(rule => `${rule.n} ${rule.countFrom === 'TRACK' ? 'track courses' : 'courses'} before this one`)
    return {
      prereqs: prereqGroups.map(suggestFrom), coreqs: coreqGroups.map(suggestFrom), prereqGroups, coreqGroups, exclusions, rules,
      ...(mod.offeredRecently === false ? { notOffered: { lastOffered: mod.lastOffered ?? null } } : {}),
    }
  }

  function warningMessages(plan, code, semId) {
    const check = checkModule(plan, code, semId)
    return [
      ...check.prereqGroups.map(group => `Prerequisite ${group.join(' or ')} must be taken in an earlier semester`),
      ...check.coreqGroups.map(group => `Corequisite ${group.join(' or ')} must be taken in the same or an earlier semester`),
      ...check.exclusions.map(c => `Exclusion with ${c} in your plan or exemptions`),
      ...check.rules.map(rule => `Requires ${rule}`),
      ...(check.notOffered ? [check.notOffered.lastOffered ? `Not offered since ${check.notOffered.lastOffered}` : 'Not offered recently'] : []),
    ]
  }

  function hasWarning(plan, code, semId) {
    if (semStatus(plan, semId) === 'done') return false
    const check = checkModule(plan, code, semId)
    return check.prereqs.length > 0 || check.coreqs.length > 0 || check.exclusions.length > 0 || check.rules.length > 0 || !!check.notOffered
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
    planActionPending.value = false
    planActionError.value = ''
    deletionRequest = null
    deletingOnServer = false
    clearTimeout(saveTimer)
    online.value = false
    planRequest = null
    plansSaving.value = false
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

  const canAddSemester = computed(() => activePlan.value.semesters.length > 0 && /^Y[1-9]S[12]$/.test(nextSemId(activePlan.value)))
  const canAddLoa = computed(() => canAddSemester.value && activePlan.value.semesters.filter(s => s.loa).length < MAX_LOA_TERMS)

  function addSemester({ loa = false } = {}) {
    if (!canAddSemester.value || (loa && !canAddLoa.value)) return
    const plan = activePlan.value
    plan.semesters.push(sem(nextSemId(plan), [], { loa }))
  }

  // The last semester can go if it was added on top of the 8-semester roadmap. Its modules return to the basket.
  const removableSemester = computed(() => {
    const plan = activePlan.value
    const last = plan.semesters.at(-1)
    return last && !/^Y[1-4]S[12]$/.test(last.id) && last.id !== plan.currentSem ? last : null
  })

  function removeSemester() {
    const last = removableSemester.value
    if (!last) return
    last.modules.map(effectiveCode).forEach(addToBasket)
    activePlan.value.semesters.pop()
  }

  // --- LOA terms ---------------------------------------------------------------------------
  // Semester ids follow their position (Y1S1, Y1S2, Y2S1, ...). When an LOA term moves or is deleted, the terms after it
  // are renumbered and keep their own modules. Only future terms change, so done and current terms keep their ids.
  const isFuture = (plan, i) => i > semIndex(plan, plan.currentSem) && i < plan.semesters.length

  function renumber(plan) {
    const [y0, s0] = plan.semesters[0].id.match(/\d/g).map(Number)
    const start = (y0 - 1) * 2 + (s0 - 1)
    const renamed = new Map()
    plan.semesters.forEach((s, i) => {
      const n = start + i
      const id = `Y${Math.floor(n / 2) + 1}S${(n % 2) + 1}`
      if (s.id === id) return
      renamed.set(s.id, id)
      Object.assign(s, sem(id, s.modules, { exchange: s.exchange, loa: s.loa }))
    })
    // Modules a collab room placed remember their semester id; keep them pointing at the same term
    placedByRoom.forEach((semId, key) => {
      if (key.startsWith(`${plan.id}|`) && renamed.has(semId)) placedByRoom.set(key, renamed.get(semId))
    })
  }

  // Can this LOA term take the place of the term targetId (that term and the ones after shift along)?
  function canMoveLoa(semId, targetId) {
    const plan = activePlan.value
    const from = semIndex(plan, semId)
    const to = semIndex(plan, targetId)
    return from !== to && plan.semesters[from]?.loa && isFuture(plan, from) && isFuture(plan, to)
  }

  function moveLoa(semId, targetId) {
    if (!canMoveLoa(semId, targetId)) return false
    const plan = activePlan.value
    const to = semIndex(plan, targetId) // the LOA lands exactly where the target term was
    const [loa] = plan.semesters.splice(semIndex(plan, semId), 1)
    plan.semesters.splice(to, 0, loa)
    renumber(plan)
    return true
  }

  // Deletes a future LOA term. Anything placed in it (an internship) returns to the basket.
  function removeLoa(semId) {
    const plan = activePlan.value
    const i = semIndex(plan, semId)
    if (!plan.semesters[i]?.loa || !isFuture(plan, i) || plan.semesters.length <= 1) return
    const [loa] = plan.semesters.splice(i, 1)
    loa.modules.map(effectiveCode).forEach(addToBasket)
    renumber(plan)
  }

  function toggleExchange(semId) {
    const s = activePlan.value.semesters.find((x) => x.id === semId)
    s.exchange = !s.exchange
  }

  // Online, a new plan keeps the active plan's major, tracks and completed semesters;
  // the semesters from the current one onwards start empty.
  async function addPlan() {
    if (plans.value.length >= MAX_PLANS) return false
    if (!online.value || planActionPending.value) return false
    const version = session
    const from = activePlan.value
    const now = semIndex(from, from.currentSem)
    planActionPending.value = true
    planActionError.value = ''
    try {
      const created = await api.createPlan({
        majorId: from.majorId,
        tracks: [...from.tracks],
        currentSem: from.currentSem,
        semesters: toApi(from).semesters.map((s, i) => ({ ...s, modules: i < now ? [...s.modules] : [] })),
      })
      if (version !== session) return false
      const plan = fromApi(created)
      remember(plan)
      plans.value.push(plan)
      activePlanId.value = plan.id
      refreshCheck(plan.id)
      return true
    } catch (error) {
      if (version === session) planActionError.value = error.message
      return false
    } finally {
      if (version === session) planActionPending.value = false
    }
  }

  function deletePlan(id) {
    if (!online.value || planActionPending.value || plans.value.length <= 1 || !plans.value.some(p => p.id === id)) return Promise.resolve(false)
    const version = session
    planActionPending.value = true
    planActionError.value = ''
    const request = Promise.resolve().then(async () => {
      try {
        if (version !== session) return false
        await savePlans()
        if (version !== session) return false
        deletingOnServer = true
        await api.deletePlan(id)
        if (version !== session) return false
        plans.value = plans.value.filter(p => p.id !== id)
        // Update only the saved names: edits made while deletion was pending still need saving.
        plans.value.forEach((p, i) => {
          p.name = `Plan ${i + 1}`
          const saved = lastSaved.get(p.id)
          if (saved) lastSaved.set(p.id, JSON.stringify({ ...JSON.parse(saved), name: p.name }))
        })
        if (activePlanId.value === id) activePlanId.value = plans.value[0].id
        lastSaved.delete(id)
        delete checks.value[id]
        return true
      } catch (error) {
        if (version === session) planActionError.value = error.message
        return false
      } finally {
        if (version === session) {
          planActionPending.value = false
          deletingOnServer = false
          deletionRequest = null
        }
      }
    })
    deletionRequest = request
    return request
  }


  // The backend's module catalogue in the shape the checklist matches against, empty until it has loaded
  const checklistCatalogue = computed(() => (catalogue.online ? catalogue.checklistModulesFor(activePlan.value.majorId) : {}))
  const exempted = computed(() => user.profile.exempted ?? [])
  const curriculumNotice = computed(() => {
    const saved = activePlan.value.majorId
    if (!catalogue.online || !saved || !user.profile.intakeYear) return ''
    const expected = catalogue.majorIdFor(user.profile.major, user.profile.intakeYear)
    return saved !== expected ? 'This plan’s saved curriculum does not match your major and intake year. Its requirements still follow the saved curriculum; review it before relying on graduation progress.' : ''
  })
  // Online, the checklist follows the plan's curriculum from the backend (GET /api/majors/:id/requirements), so edits
  // made in the admin panel show up here. curriculumLayout.js lists it under the course-progression headings and adds
  // the recommended semesters. Until the catalogue and curriculum have loaded, it reports itself unavailable.
  const checklist = computed(() => {
    const options = {
      exempted: exempted.value,
      freeExempt: user.profile.freeExemptions ?? 0,
      markedDone: user.profile.markedDone ?? [],
    }
    const bundle = catalogue.curricula[activePlan.value.majorId]
    if (catalogue.online && bundle && bundle.requirementsAvailable !== false) {
      const majorCode = catalogue.majors.find((m) => m._id === activePlan.value.majorId)?.majorCode ?? ''
      return layoutCurriculum(buildCurriculumChecklist(activePlan.value, checklistCatalogue.value, bundle, options), activePlan.value, bundle, { majorCode })
    }
    const stillLoading = catalogue.catalogueLoading || catalogue.loadingMajors.has(activePlan.value.majorId)
    const unavailableReason = stillLoading
      ? 'Loading your degree requirements…'
      : !catalogue.online
      ? 'The course catalogue has not loaded. Reload to retry; completion is unavailable until it loads.'
      : !activePlan.value.majorId
        ? 'No curriculum is selected for this plan. Your major and intake year may not be supported yet; graduation progress is unavailable.'
        : bundle?.requirementsAvailable === false
          ? 'Graduation requirements for this plan’s curriculum are not available yet.'
          : 'Live curriculum requirements have not loaded for this plan. Reload to retry; completion is unavailable until they load.'
    return { unavailable: true, loading: stillLoading, unavailableReason, groups: [], other: [], totals: { required: 0, cleared: 0, exempted: 0, inProgress: 0, planned: 0, todo: 0, late: 0 } }
  })

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
    plansSaving,
    planActionPending,
    planActionError,
    savePlans,
    checklist,
    curriculumNotice,
    checklistCatalogue,
    exempted,
    load,
    profileLoaError,
    reload,
    basket,
    basketSaving,
    basketError,
    saveBasket,
    hasAnyWarning,
    semIndex,
    semStatus,
    checkModule,
    warningMessages,
    hasWarning,
    placeModule,
    returnToBasket,
    addToBasket,
    removeFromBasket,
    clearBasket,
    addSemester,
    canAddSemester,
    canAddLoa,
    removableSemester,
    removeSemester,
    canMoveLoa,
    moveLoa,
    removeLoa,
    toggleExchange,
    addPlan,
    deletePlan,
  }
})

// Dev only: lets Vite swap this store's code in when the file is edited, instead of keeping the old store
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(usePlannerStore, import.meta.hot))
