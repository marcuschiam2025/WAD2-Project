import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { bidHistory, sections, days, weightage, MIN_BID, estimateHistory, termLabel } from '../data/bidding'
import { api } from '../services/api'
import { usePlannerStore, effectiveCode } from './planner'
import { useRoomsStore } from './rooms'
import { useUserStore } from './user'
import { findClashes, findExamClashes, sectionCode, sectionMeetings } from '../utils/clash'

// The bidding timetable is the next semester of the chosen What-If plan. Pick the plan with `planId`.
export const useBiddingStore = defineStore('bidding', () => {
  const planner = usePlannerStore()
  const rooms = useRoomsStore()
  const user = useUserStore()
  let session = 0

  const planId = ref(planner.activePlanId)
  const plan = computed(() => planner.plans.find((p) => p.id === planId.value) ?? planner.activePlan)
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
  // A member's own saved room section feeds bidding, never their What-If plans or other members' carts.
  const roomPicks = computed(() => rooms.pickedForBidding.filter(d => d.term === round.value.term))
  const roomConflicts = computed(() => [...new Set(roomPicks.value.map(d => d.module))].filter(code => new Set(roomPicks.value.filter(d => d.module === code).map(d => d.sectionId)).size > 1))
  const fromRooms = computed(() => roomPicks.value.filter(d => !roomConflicts.value.includes(d.module) && sections.some(s => s.id === d.sectionId && s.module === d.module && !s.archived && liveSections.has(s.id))))
  const roomCodes = computed(() => fromRooms.value.map(d => d.module))
  // The What-If plan decides what is bid for; a room pick adds its module only while you are still in that room.
  // A saved cart entry counts only while its module is in the plan semester, so one you removed there stays out.
  const planCodes = computed(() => [
    ...new Set([...inTarget.value.filter((c) => sections.some((s) => s.module === c && !s.archived && liveSections.has(s.id))), ...roomCodes.value, ...Object.keys(chosen.value[plan.value.id] ?? {}).filter((c) => inTarget.value.includes(c))]),
  ])
  const notOffered = computed(() => inTarget.value.filter((c) => !sections.some((s) => s.module === c && !s.archived && liveSections.has(s.id))))

  // Per plan: modules taken out of the cart, the section picked per module, and the e$ typed per module.
  // Modules taken out during this visit. A reload follows the plan and the saved cart again, so nothing stays hidden.
  const dropped = ref({})
  const chosen = ref({})
  const typed = ref({})

  const inCart = computed(() => planCodes.value.filter((c) => roomCodes.value.includes(c) || !(dropped.value[plan.value.id] ?? []).includes(c)))

  const decidedSection = (code) => fromRooms.value.find((d) => d.module === code)?.sectionId

  // Preserve saved IDs even when unavailable; only new choices default to the first active section.
  const booked = computed(() =>
    Object.fromEntries(
      inCart.value.map((code) => {
        const pick = chosen.value[plan.value.id]?.[code]
        return [code, decidedSection(code) ?? pick ?? sections.find((s) => s.module === code && !s.archived && liveSections.has(s.id))?.id]
      }),
    ),
  )

  // A personal room pick stays in sync with that room. Change the pick there to update it.
  // module code -> { roomId, roomName, module, sectionId, roomIds } for the first matching room
  const locked = computed(() => {
    const out = {}
    for (const pick of fromRooms.value) {
      if (!inCart.value.includes(pick.module) || booked.value[pick.module] !== pick.sectionId) continue
      const entry = (out[pick.module] ??= { ...pick, roomIds: [] })
      entry.roomIds.push(pick.roomId)
    }
    return out
  })
  const isLocked = (code) => code in locked.value

  // module code -> e$ bid
  const bids = computed(() =>
    Object.fromEntries(
      inCart.value.map((code) => {
        const h = estimateHistory(bidHistory[code] ?? [], round.value.round, round.value.term)
        const median = h?.length ? h[0].median : MIN_BID
        return [code, typed.value[plan.value.id]?.[code] ?? median]
      }),
    ),
  )

  const selectedModule = ref(null)
  const savedAt = ref(null)
  watch(planId, () => (selectedModule.value = null))

  const bookedSections = computed(() => Object.entries(booked.value).map(([code, id]) => sections.find(s => s.id === id && s.module === code && liveSections.has(s.id))).filter(Boolean))
  const unavailableSelections = computed(() => Object.entries(booked.value)
    .filter(([code, id]) => !sections.some(s => s.id === id && s.module === code && liveSections.has(s.id)))
    .map(([module, sectionId]) => ({ module, sectionId, section: sectionCode(sectionId, module) ?? 'Unknown section' })))
  const archivedSelections = computed(() => bookedSections.value.filter(s => s?.archived).map(s => `${s.module} ${s.section}`))
  const allocated = computed(() => Object.values(bids.value).reduce((a, b) => a + (Number(b) || 0), 0))

  function sectionsFor(code) {
    return sections.filter((s) => s.module === code && !s.archived && liveSections.has(s.id))
  }

  const clashes = computed(() => new Set([...findClashes(bookedSections.value), ...findExamClashes(bookedSections.value)].flat()))

  function swapSection(code, sectionId) {
    if (isLocked(code) || !sections.some(s => s.id === sectionId && s.module === code && !s.archived && liveSections.has(s.id))) return
    const id = plan.value.id
    chosen.value[id] = { ...chosen.value[id], [code]: sectionId }
  }

  function setBid(code, amount) {
    const id = plan.value.id
    typed.value[id] = { ...typed.value[id], [code]: amount }
  }

  // --- Backend ------------------------------------------------------------------------------
  // online once GET /api/bidding/round answers. Sections, bid history and weightage are fetched per
  // module; a module the backend has nothing for stays empty.
  const online = ref(false)
  const round = ref({ term: null, round: null, closesAt: null, availableTerms: [], configured: false })
  const saveError = ref('')
  const loadError = ref('')
  const saving = ref(false)
  const roundInfo = computed(() => {
    const date = round.value.closesAt ? new Date(round.value.closesAt) : null
    return {
      term: termLabel(round.value.term) ?? 'No section catalogue',
      name: round.value.round ? `Round ${round.value.round}` : 'Round not configured',
      closesAt: date && Number.isFinite(date.getTime()) ? date : null,
      configured: round.value.configured === true,
    }
  })
  const liveSections = reactive(new Set()) // section ids that came from the backend (only these can be saved in a cart)
  const fetched = new Set() // module codes already asked for
  const cartLoads = new Map()
  const loadedCarts = new Set() // plan ids whose saved cart has been applied

  async function fetchModules(codes) {
    const version = session
    const todo = codes.filter((c) => !fetched.has(c))
    if (!todo.length) return
    todo.forEach((c) => fetched.add(c))
    let found
    try { found = await api.sections(todo, round.value.term) }
    catch (error) {
      if (version !== session) return
      todo.forEach(code => fetched.delete(code))
      loadError.value = error.message
      return
    }
    if (version !== session) return
    // Replace whatever was loaded for these modules before; an empty result removes them.
    for (let i = sections.length - 1; i >= 0; i--) {
      if (todo.includes(sections[i].module)) { liveSections.delete(sections[i].id); sections.splice(i, 1) }
    }
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
        if (version !== session) return
        bidHistory[code] = history.map(({ term, round: r, median, min }) => ({ term, round: r, median, min }))
        weightage[code] = marks
      }),
    )
  }

  // The plan's saved cart: the section and e$ per module
  async function loadCart(id) {
    const version = session, term = round.value.term
    if (!id || loadedCarts.has(id)) return
    if (cartLoads.has(id)) return cartLoads.get(id)
    const pending = (async () => {
      try {
        const cart = await api.cart(id, term)
        if (version !== session || term !== round.value.term) return
        await fetchModules(cart.items.map(item => item.module))
        if (version !== session || term !== round.value.term) return
        chosen.value[id] = Object.fromEntries(cart.items.map(item => [item.module, item.sectionId]))
        typed.value[id] = Object.fromEntries(cart.items.map(item => [item.module, item.amount]))
        loadedCarts.add(id)
      } catch (error) {
        if (version === session && term === round.value.term) loadError.value = error.message
      }
    })()
    cartLoads.set(id, pending)
    try { await pending } finally { if (cartLoads.get(id) === pending) cartLoads.delete(id) }
  }

  async function load() {
    if (!user.isSignedIn || !planner.online) return
    const version = session
    try {
      const nextRound = await api.round()
      if (version !== session) return
      if (round.value.term !== nextRound.term) { liveSections.clear(); fetched.clear(); loadedCarts.clear(); cartLoads.clear(); chosen.value = {}; typed.value = {} }
      round.value = nextRound
      loadError.value = ''
      online.value = !!nextRound.term
    } catch (error) {
      loadError.value = error.message
      return
    }
    if (!round.value.term) return
    await Promise.all([fetchModules([...inTarget.value, ...roomPicks.value.map((d) => d.module)]), loadCart(plan.value.id)])
  }

  // Modules that show up later (another plan picked, a room accepts a section, the plan is edited)
  watch([inTarget, () => roomPicks.value.map((d) => d.module)], ([codes, roomMods]) => {
    if (online.value) fetchModules([...codes, ...roomMods])
  })
  watch(planId, (id) => {
    if (online.value) loadCart(id)
  })

  async function addRoomSection(roomId, sectionId, targetPlanId) {
    const version = session
    if (!planner.plans.some(plan => plan.id === targetPlanId)) throw new Error('Choose one of your degree plans.')
    planId.value = targetPlanId
    await load()
    if (!online.value || !round.value.term) throw new Error('Connect the bidding planner before adding this section.')
    if (!loadedCarts.has(targetPlanId)) throw new Error(loadError.value || 'Your saved cart could not be loaded. Try again.')
    const term = round.value.term
    // The room's section, looked up in the bidding term (prerequisites are checked on the bidding page)
    const room = rooms.getRoom(roomId)
    if (!room) throw new Error('This room is no longer available.')
    if (room.term && room.term !== term) throw new Error(`This room is for ${termLabel(room.term)}, but bidding is for ${termLabel(term)}.`)
    const offered = await api.sections([room.module], term)
    const found = offered.find(s => s.id === sectionId)
    if (!found) throw new Error('This section is not available in the bidding term.')
    const prepared = { section: found, term, notes: [] }
    if (version !== session) throw new Error('Your account changed. Please try again.')
    await fetchModules([prepared.section.module])
    if (version !== session || term !== round.value.term || targetPlanId !== plan.value.id) throw new Error('Your bidding context changed. Please try again.')
    const section = sections.find(s => s.id === prepared.section.id && liveSections.has(s.id))
    if (!section || prepared.term !== term) throw new Error('This section is not available in the bidding term.')
    const others = bookedSections.value.filter(s => s && s.module !== section.module)
    if (findClashes([section, ...others]).length || findExamClashes([section, ...others]).length) throw new Error('This section clashes with your current bidding choices. Review them first.')
    const amount = typed.value[targetPlanId]?.[section.module] ?? MIN_BID
    const total = others.reduce((sum, s) => sum + Number(bids.value[s.module] || 0), 0) + Number(amount)
    if (!Number.isFinite(total) || total > user.balance) throw new Error('Adding this module would exceed your available bidding balance.')
    chosen.value[targetPlanId] = { ...chosen.value[targetPlanId], [section.module]: section.id }
    typed.value[targetPlanId] = { ...typed.value[targetPlanId], [section.module]: amount }
    dropped.value[targetPlanId] = (dropped.value[targetPlanId] ?? []).filter(code => code !== section.module)
    selectedModule.value = section.module
    savedAt.value = null
    return prepared
  }

  // Take a module out of the cart (it stays in the What-If plan)
  function dropModule(code) {
    if (isLocked(code)) return
    const id = plan.value.id
    dropped.value[id] = [...(dropped.value[id] ?? []), code]
    if (selectedModule.value === code) selectedModule.value = null
    if (online.value) api.dropFromCart(code, id, round.value.term).catch((e) => (saveError.value = e.message))
  }

  // Booked sections the server does not list can't be saved
  const unsaved = computed(() => Object.entries(booked.value).filter(([, id]) => !liveSections.has(id)).map(([code]) => code))

  async function save() {
    if (saving.value) return false
    const version = session
    saveError.value = ''
    savedAt.value = null
    if (!online.value || !round.value.term || !plan.value.id) {
      saveError.value = 'Connect to the server and select a catalogue term before saving your bids.'
      return false
    }
    if (roomConflicts.value.length) { saveError.value = `You picked different sections for ${roomConflicts.value.join(', ')} in different rooms. Change your pick in those rooms before saving.`; return false }
    if (unavailableSelections.value.length) { saveError.value = 'A saved section is unavailable. Choose a replacement or remove its module before saving.'; return false }
    if (archivedSelections.value.length) { saveError.value = 'A selected section has been archived. Choose an active alternative or remove the module before saving.'; return false }
    if (clashes.value.size) { saveError.value = 'Resolve class or final-exam clashes before saving.'; return false }
    const items = Object.entries(booked.value).map(([code, sectionId]) => ({ module: code, sectionId, amount: Number(bids.value[code]) }))
    if (items.some(item => !Number.isFinite(item.amount) || item.amount < MIN_BID)) { saveError.value = `Bid at least e$ ${MIN_BID} for every module.`; return false }
    if (items.reduce((sum,item) => sum + item.amount,0) > user.balance) { saveError.value = 'Your bids exceed your available balance.'; return false }
    const payload = { planId: plan.value.id, term: round.value.term, items }
    const snapshot = JSON.stringify(payload)
    saving.value = true
    try {
      await api.saveCart(payload)
      if (version !== session || payload.planId !== plan.value.id || payload.term !== round.value.term) return false
      const current = { planId: plan.value.id, term: round.value.term, items: Object.entries(booked.value).map(([module,sectionId]) => ({module,sectionId,amount:Number(bids.value[module])})) }
      if (JSON.stringify(current) !== snapshot) { saveError.value = 'Your bids changed during saving. Save again to keep the latest changes.'; return false }
      savedAt.value = new Date()
      return true
    } catch (error) {
      if (version === session) saveError.value = error.message
      return false
    } finally { if (version === session) saving.value = false }
  }
  watch([planId, booked, bids], () => { savedAt.value = null })

  watch(() => user.uid, () => {
    session++
    online.value = false
    chosen.value = {}
    typed.value = {}
    dropped.value = {}
    selectedModule.value = null
    savedAt.value = null
    saveError.value = ''
    loadError.value = ''
    saving.value = false
    round.value = {term:null,round:null,closesAt:null,availableTerms:[],configured:false}
    loadedCarts.clear()
    cartLoads.clear()
    fetched.clear()
    liveSections.clear()
  }, { flush: 'sync' })

  // "Monday 08:15–11:30 · Thursday 08:15–11:30"; work-study and SMU-X sections have no weekly classes
  function slotLabel(s) {
    const list = sectionMeetings(s)
    if (!list.length) return 'No fixed class time'
    return list.map(meeting => `${days[meeting.day]} ${meeting.start}–${meeting.end}`).join(' · ')
  }

  return {
    planId,
    plan,
    targetSem,
    notOffered,
    fromRooms,
    roomConflicts,
    locked,
    isLocked,
    booked,
    bids,
    selectedModule,
    savedAt,
    saveError,
    loadError,
    saving,
    unsaved,
    online,
    round,
    roundInfo,
    bookedSections,
    unavailableSelections,
    archivedSelections,
    allocated,
    clashes,
    bidHistory,
    sectionsFor,
    swapSection,
    setBid,
    dropModule,
    load,
    addRoomSection,
    save,
    slotLabel,
  }
})

// Dev only: lets Vite swap this store's code in when the file is edited, instead of keeping the old store
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useBiddingStore, import.meta.hot))
