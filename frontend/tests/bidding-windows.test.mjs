import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

test('the round countdown switches from opening to closing and then closed at the exact boundaries', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  try {
    const { roundStatus } = await server.ssrLoadModule('/src/core/utils/biddingWindows.js')
    const round = { opensAt: new Date('2026-11-04T09:00:00Z'), closesAt: new Date('2026-11-06T02:00:00Z'), isOpen: false }
    assert.equal(roundStatus(round, Date.parse('2026-11-04T08:00:00Z')).label, 'Opens in 1h 0m')
    assert.equal(roundStatus(round, Date.parse('2026-11-04T09:00:00Z')).state, 'open', 'the original isOpen flag must not freeze the status before opening')
    assert.equal(roundStatus(round, Date.parse('2026-11-06T01:00:00Z')).label, 'Closes in 1h 0m')
    assert.equal(roundStatus(round, Date.parse('2026-11-06T02:00:00Z')).label, 'Round closed')
    assert.equal(roundStatus({ closesAt: round.closesAt }, Date.parse('2026-11-04T09:00:00Z')).state, 'open', 'staff deadlines without an opening date remain supported')
    assert.equal(roundStatus({}, Date.now()).label, 'Deadline not configured')
  } finally { await server.close() }
})

test('every window of the term is listed in order and marked closed, open or upcoming in Singapore time', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  try {
    const { windowsFor } = await server.ssrLoadModule('/src/core/utils/biddingWindows.js')
    const term = '2026-27_T2'
    const windows = [
      { term, round: '1A', window: 2, opensAt: '2026-11-02T09:00:00.000Z', closesAt: '2026-11-04T02:00:00.000Z', inferred: false },
      { term, round: '1A', window: 1, opensAt: '2026-10-30T09:00:00.000Z', closesAt: '2026-11-02T02:00:00.000Z', inferred: false },
      { term, round: '1A', window: 3, opensAt: '2026-11-04T09:00:00.000Z', closesAt: '2026-11-06T02:00:00.000Z', inferred: true },
      { term: '2026-27_T1', round: '1A', window: 1, opensAt: '2026-04-01T09:00:00.000Z', closesAt: '2026-04-03T02:00:00.000Z', inferred: false },
    ]
    // 4 Nov 2026, 11:00 Singapore: 1A window 2 has just closed (10:00) and window 3 opens at 17:00
    const list = windowsFor(term, Date.parse('2026-11-04T03:00:00Z'), windows)
    assert.equal(list.length, 3, 'finished windows are listed too, and other terms are not')
    assert.deepEqual(list.slice(0, 3).map(w => w.state), ['closed', 'closed', 'upcoming'])
    assert.equal(list[0].name, 'Round 1A · Window 1')
    assert.equal(list[0].when, 'Closed Mon 2 Nov, 10:00')
    assert.equal(list[2].when, 'Opens Wed 4 Nov, 17:00')
    assert.equal(list[2].inferred, true)
    const during = windowsFor(term, Date.parse('2026-11-03T03:00:00Z'), windows)
    assert.deepEqual(during.filter(w => w.state === 'open').map(w => w.name), ['Round 1A · Window 2'])
    assert.equal(during.find(w => w.state === 'open').when, 'Closes Wed 4 Nov, 10:00')
    assert.deepEqual(windowsFor('2099-00_T9', Date.now(), windows), [], 'a term without listed windows gives nothing, so the dashboard falls back to the open round')
  } finally { await server.close() }
})

test('the bidding store loads the term\'s windows from the backend and survives a failed request', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error', resolve: (await import('../vite.config.js')).default.resolve, plugins: (await import('../vite.config.js')).default.plugins })
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  try {
    const { createPinia, setActivePinia } = await import('pinia')
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useBiddingStore } = await server.ssrLoadModule('/src/core/stores/bidding.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'student'; user.isSignedIn = true
    const planner = usePlannerStore()
    planner.plans = [{ id: 'p', name: 'Plan 1', tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', label: 'Y1 · S2', modules: [] }] }]
    planner.activePlanId = 'p'; planner.online = true
    const term = '2026-27_T2'
    const asked = []
    api.round = async () => ({ term, round: '1A', configured: true, closesAt: '2099-01-01T00:00:00Z' })
    api.cart = async () => ({ items: [] })
    api.biddingWindows = async (t) => { asked.push(t); throw new Error('offline') }
    const bidding = useBiddingStore()
    await bidding.load()
    assert.deepEqual(bidding.windows, [], 'a failed request leaves the list empty instead of breaking the load')
    assert.equal(bidding.online, true)
    const rows = [{ term, round: '1A', window: 1, opensAt: '2026-10-30T09:00:00.000Z', closesAt: '2026-11-02T02:00:00.000Z', inferred: false }]
    api.biddingWindows = async (t) => { asked.push(t); return rows }
    await bidding.load()
    assert.deepEqual(bidding.windows, rows)
    assert.deepEqual(asked, [term, term])
  } finally { await server.close() }
})
