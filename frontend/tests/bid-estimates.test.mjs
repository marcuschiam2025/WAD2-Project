import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('bid estimates use one round and the latest three valid earlier terms', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { estimateHistory, rateBid, canEstimateBid } = await server.ssrLoadModule('/src/core/data/bidding.js')
    assert.equal(canEstimateBid('1A', null), false)
    assert.equal(canEstimateBid('all', '2026-27_T2'), false)
    assert.equal(canEstimateBid('1A', '2026-27_T2'), true)
    const rows = [
      { term: 'AY25/26 T1', round: '1B', median: 100 },
      { term: 'AY24/25 T1', round: '1A', median: 15 },
      { term: 'AY26/27 T2', round: '1A', median: 900 },
      { term: 'AY26/27 T3', round: '1A', median: 1000 },
      { term: 'AY25/26 T2', round: '1A', median: 25 },
      { term: '2026-27_T1', round: '1A', median: 35 },
      { term: 'AY25/26 T1', round: '1A', median: 15 },
      { term: 'AY26/99 T1', round: '1A', median: 800 },
      { term: 'AY26/27 T1', round: '1A', median: 35 },
      { term: 'AY25/26 T3', round: '1A', median: null },
    ]
    assert.equal(rateBid(50, rows), null, 'mixed rounds must not produce a risk rating')
    const recent = estimateHistory(rows, '1A', '2026-27_T2')
    assert.deepEqual(recent.map(h => h.median), [35, 25, 15])
    assert.equal(recent.length, 3, 'one observation per academic term')
    assert.deepEqual(estimateHistory(rows, 'all', '2026-27_T2'), [])
    assert.deepEqual(estimateHistory(rows, null, '2026-27_T2'), [])
    assert.deepEqual(estimateHistory(rows, '1A', 'invalid'), [])
    assert.deepEqual(estimateHistory(rows, '2', '2026-27_T2'), [])
    assert.equal(rateBid(50, recent).mean, 25)
    assert.equal(rateBid('', recent), null)
    assert.equal(rateBid(NaN, recent), null)
    assert.equal(rows.length, 10, 'selection must not mutate the history table')
  } finally { await server.close() }
})

test('new cart bids use the configured round while explicit saved bids remain unchanged', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useBiddingStore } = await server.ssrLoadModule('/src/core/stores/bidding.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'bidder'; user.isSignedIn = true
    const planner = usePlannerStore()
    planner.plans = [{ id: 'p', name: 'Plan', tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', modules: ['IS216'] }] }]
    planner.activePlanId = 'p'; planner.online = true
    api.round = async () => ({ term: '2026-27_T2', round: '1B' })
    api.sections = async () => [{ id: 's', module: 'IS216', section: 'G1', sessions: [] }]
    api.bidHistory = async () => [
      { term: 'AY26/27 T1', round: '1A', median: 90 },
      { term: 'AY26/27 T2', round: '1B', median: 900 },
      { term: 'AY26/27 T1', round: '1B', median: 25 },
    ]
    api.weightage = async () => []; api.cart = async () => ({ items: [] })
    const bidding = useBiddingStore(); await bidding.load()
    assert.equal(bidding.bids.IS216, 25, 'use the newest earlier term for the configured round')
    bidding.setBid('IS216', 42)
    bidding.round.round = '2'
    assert.equal(bidding.bids.IS216, 42, 'round changes must not overwrite explicit amounts')
    user.uid = 'other'
  } finally { await server.close() }
})
