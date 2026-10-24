import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('explicit room handoff selects one cart and saved extra modules survive reload', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ root: decodeURIComponent(new URL('..', import.meta.url).pathname), configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useBiddingStore } = await server.ssrLoadModule('/src/core/stores/bidding.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true
    const planner = usePlannerStore(); planner.plans = ['p1','p2'].map(id => ({ id, name: id, currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', modules: [] }] })); planner.activePlanId = 'p1'; planner.online = true
    const section = { id: '2026-27_T1:IS216:G1', module: 'IS216', section: 'G1', sessions: [{ day: 0, start: '08:15', end: '09:45' }] }
    api.round = async () => ({ term: '2026-27_T1' })
    api.sections = async codes => codes.includes('IS216') ? [section] : []
    api.bidHistory = async () => []; api.weightage = async () => []
    let items = []
    let releaseCart
    const cartGate = new Promise(resolve => { releaseCart = resolve })
    api.cart = async id => { if (id === 'p1') await cartGate; return { items: id === 'p1' ? items : [] } }
    api.roomHandoff = async (id, data) => { assert.equal(id, 'r'); assert.equal(data.planId, 'p1'); return { term: '2026-27_T1', section, notes: [] } }
    const bidding = useBiddingStore()
    assert.equal(typeof bidding.addRoomSection, 'function', 'explicit room-to-bidding action is required')
    const loading = bidding.load()
    await new Promise(resolve => setTimeout(resolve, 0))
    let finished = false
    const adding = bidding.addRoomSection('r', section.id, 'p1').then(() => { finished = true })
    await new Promise(resolve => setTimeout(resolve, 0))
    const finishedBeforeCart = finished
    releaseCart()
    await Promise.all([loading, adding])
    assert.equal(finishedBeforeCart, false, 'handoff must wait for the in-flight saved cart read')
    assert.equal(bidding.booked.IS216, section.id)
    assert.deepEqual(planner.plans[0].semesters[1].modules, [])
    assert.deepEqual(planner.plans[1].semesters[1].modules, [])
    api.saveCart = async data => { items = data.items }
    assert.equal(await bidding.save(), true)
    assert.equal(items[0].sectionId, section.id)
    bidding.planId = 'p2'
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(bidding.booked.IS216, undefined)
    setActivePinia(createPinia())
    const restoredUser = useUserStore(); restoredUser.uid = 'a'; restoredUser.isSignedIn = true
    const restoredPlanner = usePlannerStore(); restoredPlanner.plans = ['p1','p2'].map(id => ({ id, name: id, currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', modules: [] }] })); restoredPlanner.activePlanId = 'p1'; restoredPlanner.online = true
    const restored = useBiddingStore()
    await restored.load()
    assert.equal(restored.booked.IS216, section.id)

  } finally { await server.close() }
})
