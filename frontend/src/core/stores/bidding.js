import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { bidHistory, sections, slots, days, MIN_BID } from '../data/bidding'
import { usePlannerStore, effectiveCode } from './planner'
import { useRoomsStore } from './rooms'

// Starting e$ for a module the student has not bid on yet in this plan
// TODO(backend): saved bids come from GET /api/bidding/cart?plan=…
const sampleBids = { IS212: 42, IS213: 30, IS214: 22, IS215: 18, COR3001: 36, IS442: 20 }

// The bidding timetable is the next semester of the chosen What-If plan. Pick the plan with `planId`.
export const useBiddingStore = defineStore('bidding', () => {
  const planner = usePlannerStore()
  const rooms = useRoomsStore()

  const planId = ref(planner.activePlanId)
  const plan = computed(() => planner.plans.find((p) => p.id === planId.value) ?? planner.plans[0])

  // The semester after the plan's current one: the one being bid for
  const targetSem = computed(() => {
    const i = plan.value.semesters.findIndex((s) => s.id === plan.value.currentSem)
    return plan.value.semesters[i + 1] ?? null
  })

  // Modules of that semester with sections in the bidding data, and the ones without any
  const inTarget = computed(() => {
    const t = targetSem.value
    if (!t || t.exchange || t.loa) return []
    return [...new Set(t.modules.map(effectiveCode))]
  })
  // Modules decided in collab rooms are bid for whichever plan is picked
  const roomCodes = computed(() => rooms.decided.map((d) => d.module).filter((c) => sections.some((s) => s.module === c)))
  const planCodes = computed(() => [
    ...new Set([...inTarget.value.filter((c) => sections.some((s) => s.module === c)), ...roomCodes.value]),
  ])
  // Modules in the timetable only because a collab room decided on them (not in the plan's next semester)
  const fromRooms = computed(() => rooms.decided.filter((d) => roomCodes.value.includes(d.module)))
  const notOffered = computed(() => inTarget.value.filter((c) => !sections.some((s) => s.module === c)))

  // Per plan: modules taken out of the cart, the section picked per module, and the e$ typed per module
  const dropped = ref({})
  const chosen = ref({})
  const typed = ref({})

  const inCart = computed(() => planCodes.value.filter((c) => !(dropped.value[plan.value.id] ?? []).includes(c)))

  const decidedSection = (code) => rooms.decided.find((d) => d.module === code)?.sectionId

  // Sections accepted in a collab room are locked: they can't be swapped until the accept is undone in the room
  const locked = computed(() =>
    Object.fromEntries(rooms.decided.filter((d) => inCart.value.includes(d.module)).map((d) => [d.module, d])),
  )
  const isLocked = (code) => code in locked.value

  // module code -> booked section id
  const booked = computed(() =>
    Object.fromEntries(
      inCart.value.map((code) => [code, decidedSection(code) ?? chosen.value[plan.value.id]?.[code] ?? sections.find((s) => s.module === code).id]),
    ),
  )

  // module code -> e$ bid
  const bids = computed(() =>
    Object.fromEntries(
      inCart.value.map((code) => {
        const h = bidHistory[code]
        const median = h?.length ? h[0].median : MIN_BID
        return [code, typed.value[plan.value.id]?.[code] ?? sampleBids[code] ?? median]
      }),
    ),
  )

  const selectedModule = ref(null)
  const savedAt = ref(null)
  watch(planId, () => (selectedModule.value = null))

  const bookedSections = computed(() => Object.values(booked.value).map((id) => sections.find((s) => s.id === id)))
  const allocated = computed(() => Object.values(bids.value).reduce((a, b) => a + (Number(b) || 0), 0))

  function sectionsFor(code) {
    return sections.filter((s) => s.module === code)
  }

  // Booked sections that share a day + slot with another booked section
  const clashes = computed(() => {
    const seen = {}
    bookedSections.value.forEach((s) => {
      const key = `${s.day}-${s.slot}`
      seen[key] = [...(seen[key] ?? []), s.id]
    })
    return new Set(Object.values(seen).filter((ids) => ids.length > 1).flat())
  })

  function swapSection(code, sectionId) {
    if (isLocked(code)) return
    const id = plan.value.id
    chosen.value[id] = { ...chosen.value[id], [code]: sectionId }
  }

  function setBid(code, amount) {
    const id = plan.value.id
    typed.value[id] = { ...typed.value[id], [code]: amount }
  }

  // Take a module out of the cart (it stays in the What-If plan)
  // TODO(Backend 3): DELETE /api/bidding/cart/:code
  function dropModule(code) {
    const id = plan.value.id
    dropped.value[id] = [...(dropped.value[id] ?? []), code]
    if (selectedModule.value === code) selectedModule.value = null
  }

  // TODO(Backend 3): PUT /api/bidding/cart
  function save() {
    savedAt.value = new Date()
  }

  function slotLabel(s) {
    return `${days[s.day]} · ${slots[s.slot].start}–${slots[s.slot].end}`
  }

  return {
    planId,
    plan,
    targetSem,
    notOffered,
    fromRooms,
    locked,
    isLocked,
    booked,
    bids,
    selectedModule,
    savedAt,
    bookedSections,
    allocated,
    clashes,
    bidHistory,
    sectionsFor,
    swapSection,
    setBid,
    dropModule,
    save,
    slotLabel,
  }
})
