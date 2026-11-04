import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('unavailable saved sections retain their IDs and amounts until explicitly replaced, and cart-only modules outside the plan stay out', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useBiddingStore } = await server.ssrLoadModule('/src/core/stores/bidding.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true
    const planner = usePlannerStore()
    planner.plans = [{ id: 'p1', name: 'Plan', currentSem: 'Y2S1', semesters: [{ id: 'Y2S1', modules: [] }, { id: 'Y2S2', modules: ['IS216', 'IS112'] }] }]
    planner.activePlanId = 'p1'; planner.online = true
    const term = '2026-27_T2', missing = `${term}:IS216:G9`, gone = `${term}:IS999:G7`
    const alternative = { id: `${term}:IS216:G1`, module: 'IS216', section: 'G1', sessions: [] }
    const newModule = { id: `${term}:IS112:G1`, module: 'IS112', section: 'G1', sessions: [] }
    api.round = async () => ({ term })
    api.sections = async codes => [alternative, newModule].filter(s => codes.includes(s.module))
    api.bidHistory = async () => []; api.weightage = async () => []
    api.cart = async () => ({ items: [{ module: 'IS216', sectionId: missing, amount: 25 }, { module: 'IS999', sectionId: gone, amount: 30 }] })
    const writes = [], drops = []
    api.saveCart = async payload => { writes.push(payload) }
    api.dropFromCart = async (...args) => { drops.push(args) }
    const bidding = useBiddingStore(); await bidding.load()
    assert.equal(bidding.booked.IS216, missing, 'do not silently replace G9 with G1')
    assert.equal(bidding.booked.IS999, undefined, 'a saved module that is no longer in the What-If semester is not shown')
    assert.equal(bidding.bids.IS216, 25)
    assert.equal(bidding.booked.IS112, newModule.id, 'new unsaved modules may still use their default section')
    assert.deepEqual(bidding.unavailableSelections.map(s => s.sectionId), [missing])
    assert.deepEqual(bidding.bookedSections.map(s => s.id), [newModule.id], 'missing sections cannot reach timetable or clash calculations')
    assert.equal(bidding.clashes.size, 0)
    assert.equal(await bidding.save(), false)
    assert.match(bidding.saveError, /unavailable/i)
    assert.equal(writes.length, 0)
    bidding.swapSection('IS216', alternative.id)
    assert.equal(bidding.booked.IS216, alternative.id)
    assert.equal(bidding.bids.IS216, 25, 'replacing a section preserves the saved bid')
    assert.deepEqual(bidding.unavailableSelections, [])
    assert.equal(await bidding.save(), true)
    assert.deepEqual(writes[0].items, [{ module: 'IS216', sectionId: alternative.id, amount: 25 }, { module: 'IS112', sectionId: newModule.id, amount: 10 }])
    user.uid = 'b'
    assert.deepEqual(bidding.unavailableSelections, [], 'unavailable choices do not leak across accounts')
  } finally { await server.close() }
})
