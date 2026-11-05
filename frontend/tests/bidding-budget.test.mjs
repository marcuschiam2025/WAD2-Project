import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('cart saving and room imports accept an exact decimal budget and reject a cent over', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useBiddingStore } = await server.ssrLoadModule('/src/core/stores/bidding.js')
    const { useRoomsStore } = await server.ssrLoadModule('/src/core/stores/rooms.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true; user.balance = 210
    const planner = usePlannerStore()
    const modules = ['IS216', 'IS111', 'IS112'], term = '2026-27_T2'
    planner.plans = [{ id: 'p', tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', modules }] }]
    planner.activePlanId = 'p'; planner.online = true
    api.round = async () => ({ term })
    api.sections = async codes => codes.map(module => ({ id: `${module}-G1`, module, section: 'G1', sessions: [] }))
    api.bidHistory = async () => []; api.weightage = async () => []; api.cart = async () => ({ items: [] })
    const writes = []
    api.saveCart = async payload => { writes.push(payload) }
    const bidding = useBiddingStore(); await bidding.load()
    ;[10.02, 128.30, 71.68].forEach((amount, i) => bidding.setBid(modules[i], amount))
    assert.equal(await bidding.save(), true, 'valid decimal bids must be allowed to use the exact balance')
    assert.equal(bidding.allocated, 210)
    assert.deepEqual(writes[0].items.map(item => item.amount), [10.02, 128.30, 71.68])
    useRoomsStore().rooms = [{ id: 'r', module: 'IS216', term, lockedSection: 'IS216-G1', members: ['me'], admins: [], votes: {}, suggestedBids: {} }]

    user.balance = 209.99
    assert.equal(await bidding.save(), false)
    assert.match(bidding.saveError, /exceed/)
    assert.equal(writes.length, 1, 'over-budget carts must never reach the API')

    user.balance = 210.01
    assert.equal(await bidding.save(), true)
    bidding.setBid('IS216', 10.021)
    assert.equal(await bidding.save(), false, 'extra precision must not be silently rounded into a valid bid')
    assert.match(bidding.saveError, /decimal/)
    assert.equal(writes.length, 2)
  } finally { await server.close() }
})
