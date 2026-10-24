import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('archived saved sections remain visible but cannot be newly selected or saved', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useBiddingStore } = await server.ssrLoadModule('/src/core/stores/bidding.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true
    const planner = usePlannerStore(); planner.plans = [{ id: 'p1', name: 'Plan', currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', modules: ['IS216'] }] }]; planner.activePlanId = 'p1'; planner.online = true
    const old = { id: '2026-27_T2:IS216:G1', module: 'IS216', section: 'G1', archived: true, sessions: [{ day: 0, start: '09:00', end: '10:00' }] }
    const live = { ...old, id: '2026-27_T2:IS216:G2', section: 'G2', archived: false }
    api.round = async () => ({ term: '2026-27_T2' })
    api.sections = async () => [old, live]
    api.bidHistory = async () => []; api.weightage = async () => []
    api.cart = async () => ({ items: [{ module: 'IS216', sectionId: old.id, amount: 10 }] })
    let writes = 0
    api.saveCart = async () => { writes++ }
    const bidding = useBiddingStore()
    await bidding.load()
    assert.equal(bidding.booked.IS216, old.id, 'do not silently replace a persisted archived selection')
    assert.deepEqual(bidding.sectionsFor('IS216').map(s => s.id), [live.id])
    assert.equal(await bidding.save(), false)
    assert.equal(writes, 0)
    assert.match(bidding.saveError, /archived/i)
    bidding.swapSection('IS216', live.id)
    bidding.swapSection('IS216', old.id)
    assert.equal(bidding.booked.IS216, live.id)
    assert.equal(await bidding.save(), true)
    assert.equal(writes, 1)
  } finally { await server.close() }
})
