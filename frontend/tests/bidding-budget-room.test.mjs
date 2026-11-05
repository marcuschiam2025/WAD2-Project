import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

const term = '2026-27_T2'

test('a room lock that pushes the bids over the balance is reported at once, naming the room, and saving is refused', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  try {
    const load = (p) => server.ssrLoadModule(p)
    const { useUserStore } = await load('/src/core/stores/user.js')
    const { usePlannerStore } = await load('/src/core/stores/planner.js')
    const { useBiddingStore } = await load('/src/core/stores/bidding.js')
    const { useRoomsStore } = await load('/src/core/stores/rooms.js')
    const { api } = await load('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true; user.balance = 106
    const planner = usePlannerStore()
    planner.plans = [{ id: 'p', name: 'Plan 1', tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', modules: ['IS111', 'IS112'] }] }]
    planner.activePlanId = 'p'; planner.online = true
    api.round = async () => ({ term })
    api.sections = async (codes) => codes.map((module) => ({ id: `${term}:${module}:G1`, module, section: 'G1', sessions: [] }))
    api.bidHistory = async (code) => [{ term: '2025-26_T2', round: '1A', median: code === 'CS204' ? 10 : 49.5, min: 5 }]
    api.weightage = async () => []; api.cart = async () => ({ items: [] }); api.dropFromCart = async () => {}
    const writes = []
    api.saveCart = async (payload) => { writes.push(payload) }
    const bidding = useBiddingStore()
    const rooms = useRoomsStore()

    await bidding.load()
    bidding.setBid('IS111', 49.5); bidding.setBid('IS112', 49.5)
    assert.equal(bidding.allocated, 99)
    assert.equal(bidding.overBudget, 0, 'e$ 99 of e$ 106 fits')
    assert.deepEqual([...bidding.roomBids], [])

    rooms.rooms = [{ id: 'r1', name: 'OOP gang', module: 'CS204', term, lockedSection: `${term}:CS204:G1`, members: ['me'], admins: [], votes: {} }]
    await bidding.load()
    bidding.setBid('CS204', 15)
    assert.equal(bidding.allocated, 114)
    assert.equal(bidding.overBudget, 8, 'e$ 114 against e$ 106')
    assert.equal(bidding.roomBids.length, 1)
    assert.deepEqual({ ...bidding.roomBids[0] }, { code: 'CS204', roomId: 'r1', roomName: 'OOP gang', amount: 15 })

    assert.equal(await bidding.save(), false)
    assert.match(bidding.saveError, /exceed your available balance by e\$ 8\.00/)
    assert.match(bidding.saveError, /OOP gang locked CS204.*bid of e\$ 15\.00/)
    assert.equal(writes.length, 0, 'nothing reaches the server')

    bidding.setBid('IS111', 41.5)
    assert.equal(bidding.overBudget, 0)
    assert.equal(await bidding.save(), true)
    assert.equal(writes.length, 1)
  } finally { await server.close() }
})
