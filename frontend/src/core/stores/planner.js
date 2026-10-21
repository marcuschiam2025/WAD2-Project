import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { modules, requirementBuckets } from '../data/catalogue'
import { useRoomsStore } from './rooms'

export const MAX_PLANS = 3
export const MAX_MODULES_PER_SEM = 6

// A semester has room for a module if it already holds it (a move) or is under the maximum
export const hasRoom = (sem, code) => sem.modules.includes(code) || sem.modules.length < MAX_MODULES_PER_SEM

// Exchange chips look like "CS412 → IS460"; the mapped SMU code is on the right.
export function effectiveCode(entry) {
  return entry.split('→').pop().trim()
}

function sem(id, mods, extra = {}) {
  const [y, s] = id.match(/\d/g)
  return { id, label: `Y${y} · S${s}`, exchange: false, loa: false, modules: mods, ...extra }
}

// y2s2 is the semester the BOSS Bidding Planner bids for, so it differs between the sample plans.
const PLAN_1_Y2S2 = ['IS442', 'IS215', 'IS214']

function samplePlan(id, name, tracks, y2s2 = PLAN_1_Y2S2) {
  return {
    id,
    name,
    tracks,
    currentSem: 'Y2S1',
    semesters: [
      sem('Y1S1', ['IS111', 'IS112', 'GEC101', 'COR1100']),
      sem('Y1S2', ['IS113', 'IS210', 'GEC102', 'COR2100']),
      sem('Y2S1', ['IS211', 'IS216', 'IS213', 'STAT151']),
      sem('Y2S2', [...y2s2]),
      sem('Y3S1', ['CS412 → IS460', 'IS330 → IS4302', 'HSS210'], { exchange: true }),
      sem('Y3S2', ['IS424', 'IS428', 'IS460']),
      sem('Y4S1', ['IS483', 'IS441']),
      sem('Y4S2', ['IS480', 'UE elective']),
    ],
  }
}

export const usePlannerStore = defineStore('planner', () => {
  const plans = ref([
    samplePlan(1, 'Plan 1', ['BA', 'SMT']),
    samplePlan(2, 'Plan 2', ['BA', 'FT'], ['IS442', 'IS212', 'COR3001']),
    samplePlan(3, 'Plan 3', ['PD'], ['IS212', 'IS214', 'IS215']),
  ])
  const activePlanId = ref(1)
  const basket = ref(['IS460', 'IS441', 'IS428', 'IS453', 'IS217'])

  const activePlan = computed(() => plans.value.find((p) => p.id === activePlanId.value))

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

  // Prereqs must sit in an earlier semester; coreqs in the same semester or a completed one.
  function checkModule(plan, code, semId) {
    const mod = modules[effectiveCode(code)]
    if (!mod) return { prereqs: [], coreqs: [] }
    const target = semIndex(plan, semId)
    const now = semIndex(plan, plan.currentSem)
    const placedAt = (c) =>
      plan.semesters.findIndex((s) => s.modules.some((m) => effectiveCode(m) === c))
    const prereqs = mod.prereqs.filter((p) => {
      const at = placedAt(p)
      return at === -1 || at >= target
    })
    const coreqs = mod.coreqs.filter((c) => {
      const at = placedAt(c)
      return !(at === target || (at !== -1 && at < now))
    })
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

  // Modules accepted in collab rooms are placed in the next semester of every plan (the one being bid for),
  // unless a plan already has them somewhere. Undoing the accept takes them out again, as long as they are still
  // where they were placed. A plan with no biddable next semester (or a full one) gets the module in the basket instead.
  const rooms = useRoomsStore()
  const placedByRoom = new Map() // "planId|code" -> the semester it was placed in
  const basketFromRoom = new Set()
  const inPlan = (plan, code) => plan.semesters.some((s) => s.modules.some((m) => effectiveCode(m) === code))
  watch(
    () => rooms.decided.map((d) => d.module),
    (now, before = []) => {
      now
        .filter((code) => !before.includes(code))
        .forEach((code) => {
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
        })
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

  function addPlan() {
    if (plans.value.length >= MAX_PLANS) return false
    const id = Math.max(0, ...plans.value.map((p) => p.id)) + 1
    plans.value.push(samplePlan(id, `Plan ${plans.value.length + 1}`, [...activePlan.value.tracks]))
    activePlanId.value = id
    return true
  }

  function deletePlan(id) {
    if (plans.value.length <= 1) return
    plans.value = plans.value.filter((p) => p.id !== id)
    plans.value.forEach((p, i) => (p.name = `Plan ${i + 1}`))
    activePlanId.value = plans.value[0].id
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
  const hasAnyWarning = computed(() => {
    const plan = activePlan.value
    return plan.semesters.some((s) => s.modules.some((m) => hasWarning(plan, m, s.id)))
  })

  return {
    plans,
    activePlanId,
    activePlan,
    basket,
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
    addSemester,
    toggleExchange,
    addPlan,
    deletePlan,
  }
})

// Dev only: lets Vite swap this store's code in when the file is edited, instead of keeping the old store
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(usePlannerStore, import.meta.hot))
