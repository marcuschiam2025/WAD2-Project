import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { bidHistory, sections, slots, days, weightage, MIN_BID } from '../data/bidding'
import { api } from '../services/api'
import { usePlannerStore, effectiveCode } from './planner'
import { useRoomsStore } from './rooms'

// Starting e$ for a module the student has not bid on yet in this plan (offline, or no saved cart)
const sampleBids = { IS212: 42, IS213: 30, IS214: 22, IS215: 18, COR3001: 36, IS442: 20 }

// The bidding timetable is the next semester of the chosen What-If plan. Pick the plan with `planId`.
export const useBiddingStore = defineStore('bidding', () => {
  const planner = usePlannerStore()
  const rooms = useRoomsStore()

  const planId = ref(planner.activePlanId)
  const plan = computed(() => planner.plans.find((p) => p.id === planId.value) ?? planner.plans[0])
  // Plans loaded from the backend get new ids: follow the planner when the picked plan is gone
  watch(
    () => planner.plans.map((p) => p.id),
    (ids) => {
      if (!ids.includes(planId.value)) planId.value = planner.activePlanId
    },
  )

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

  // Per plan: modules taken out of the cart, the section picked per module, and the e$ typed per module.
  // The dropped list is kept in this browser: the saved cart can't tell a dropped module from a new one.
  const DROPPED_KEY = 'bidmaxxer:dropped'
  const dropped = ref(loadDropped())
  function loadDropped() {
    try {
      return JSON.parse(localStorage.getItem(DROPPED_KEY)) ?? {}
    } catch {
      return {}
    }
  }
  watch(
    dropped,
    () => {
      try {
        localStorage.setItem(DROPPED_KEY, JSON.stringify(dropped.value))
      } catch {
        // storage blocked: the list still works for this session
      }
    },
    { deep: true },
  )
  const chosen = ref({})
  const typed = ref({})

  const inCart = computed(() => planCodes.value.filter((c) => !(dropped.value[plan.value.id] ?? []).includes(c)))

  const decidedSection = (code) => rooms.decided.find((d) => d.module === code)?.sectionId

  // Sections accepted in a collab room are locked: they can't be swapped until the accept is undone in the room
  const locked = computed(() =>
    Object.fromEntries(rooms.decided.filter((d) => inCart.value.includes(d.module)).map((d) => [d.module, d])),
  )
  const isLocked = (code) => code in locked.value

  // module code -> booked section id (a saved section that no longer exists falls back to the first one)
  const booked = computed(() =>
    Object.fromEntries(
      inCart.value.map((code) => {
        const pick = chosen.value[plan.value.id]?.[code]
        const valid = sections.some((s) => s.id === pick && s.module === code)
        return [code, decidedSection(code) ?? (valid ? pick : sections.find((s) => s.module === code).id)]
      }),
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

  // --- Backend ------------------------------------------------------------------------------
  // online once GET /api/bidding/round answers. Sections, bid history and weightage are fetched per
  // module and replace the sample data for that module; modules the backend has nothing for keep the sample.
  const online = ref(false)
  const round = ref({ term: 'AY24/25 T2', round: '1A', closesAt: null })
  const saveError = ref('')
  // Sample closing time, used while offline or when the backend's round has already closed
  // (its default BIDDING_ROUND_CLOSES_AT is in Jan 2025)
  const sampleClose = new Date(Date.now() + (2 * 60 + 15) * 60 * 1000)
  // The round for the screens: 'AY24/25 T2' -> 'AY24/25 · Sem 2 · Round 1A'
  const roundInfo = computed(() => {
    const closes = round.value.closesAt && new Date(round.value.closesAt)
    return {
      term: `${round.value.term.replace(/ T(\d)$/,' · Sem $1')} · Round ${round.value.round}`,
      name: `Round ${round.value.round}`,
      closesAt: closes > new Date() ? closes : sampleClose,
    }
  })
  const liveSections = reactive(new Set()) // section ids that came from the backend (only these can be saved in a cart)
  const fetched = new Set() // module codes already asked for
  const loadedCarts = new Set() // plan ids whose saved cart has been applied

  async function fetchModules(codes) {
    const todo = codes.filter((c) => !fetched.has(c))
    if (!todo.length) return
    todo.forEach((c) => fetched.add(c))
    const found = await api.sections(todo, round.value.term).catch(() => [])
    const byModule = {}
    found.forEach((s) => (byModule[s.module] ??= []).push(s))
    Object.entries(byModule).forEach(([code, list]) => {
      for (let i = sections.length - 1; i >= 0; i--) if (sections[i].module === code) sections.splice(i, 1)
      sections.push(...list)
      list.forEach((s) => liveSections.add(s.id))
    })
    await Promise.all(
      todo.map(async (code) => {
        const [history, marks] = await Promise.all([
          api.bidHistory(code).catch(() => []),
          api.weightage(code).catch(() => []),
        ])
        if (history.length) bidHistory[code] = history.map(({ term, round: r, median, min }) => ({ term, round: r, median, min }))
        if (marks.length) weightage[code] = marks
      }),
    )
  }

  // The plan's saved cart: the section and e$ per module
  async function loadCart(id) {
    if (loadedCarts.has(id)) return
    loadedCarts.add(id)
    try {
      const cart = await api.cart(id, round.value.term)
      cart.items.forEach((item) => {
        chosen.value[id] = { ...chosen.value[id], [item.module]: item.sectionId }
        typed.value[id] = { ...typed.value[id], [item.module]: item.amount }
      })
    } catch {
      loadedCarts.delete(id)
    }
  }

  async function load() {
    try {
      round.value = await api.round()
      online.value = true
    } catch {
      return // no backend: sample data only
    }
    await Promise.all([fetchModules([...inTarget.value, ...rooms.decided.map((d) => d.module)]), loadCart(plan.value.id)])
  }

  // Modules that show up later (another plan picked, a room accepts a section, the plan is edited)
  watch([inTarget, () => rooms.decided.map((d) => d.module)], ([codes, roomMods]) => {
    if (online.value) fetchModules([...codes, ...roomMods])
  })
  watch(planId, (id) => {
    if (online.value) loadCart(id)
  })

  // Take a module out of the cart (it stays in the What-If plan)
  function dropModule(code) {
    const id = plan.value.id
    dropped.value[id] = [...(dropped.value[id] ?? []), code]
    if (selectedModule.value === code) selectedModule.value = null
    if (online.value) api.dropFromCart(code, id, round.value.term).catch((e) => (saveError.value = e.message))
  }

  // Modules whose sections are only sample data can't be saved: the backend doesn't know those sections
  const unsaved = computed(() => Object.entries(booked.value).filter(([, id]) => !liveSections.has(id)).map(([code]) => code))

  async function save() {
    saveError.value = ''
    if (!online.value) {
      savedAt.value = new Date()
      return
    }
    const items = Object.entries(booked.value)
      .filter(([, id]) => liveSections.has(id))
      .map(([code, sectionId]) => ({ module: code, sectionId, amount: Number(bids.value[code]) || 0 }))
    const low = items.find((i) => i.amount < MIN_BID)
    if (low) {
      saveError.value = `Bid at least e$ ${MIN_BID} for ${low.module}.`
      return
    }
    try {
      await api.saveCart({ planId: plan.value.id, term: round.value.term, items })
      savedAt.value = new Date()
    } catch (e) {
      saveError.value = e.message
    }
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
    saveError,
    unsaved,
    online,
    round,
    roundInfo,
    bookedSections,
    allocated,
    clashes,
    bidHistory,
    sectionsFor,
    swapSection,
    setBid,
    dropModule,
    load,
    save,
    slotLabel,
  }
})

// Dev only: lets Vite swap this store's code in when the file is edited, instead of keeping the old store
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useBiddingStore, import.meta.hot))
