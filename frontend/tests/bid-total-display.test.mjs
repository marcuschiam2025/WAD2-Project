import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

test('allocated credits display two decimals despite floating-point addition', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: Sidebar } = await server.ssrLoadModule('/src/components/BidSidebar.vue')
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useBiddingStore } = await server.ssrLoadModule('/src/core/stores/bidding.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    const pinia = createPinia(); setActivePinia(pinia)
    const user = useUserStore(); user.uid = 'student'; user.isSignedIn = true; user.balance = 138
    const planner = usePlannerStore()
    planner.plans = [{ id: 'plan', tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', modules: ['IS216', 'IS111'] }] }]
    planner.activePlanId = 'plan'; planner.online = true
    api.round = async () => ({ term: '2026-27_T2', round: null, configured: false })
    api.sections = async () => ['IS216', 'IS111'].map(module => ({ id: `${module}-G1`, module, section: 'G1', sessions: [], exam: 'No final exam' }))
    api.cart = async () => ({ items: [] })
    api.bidHistory = async () => []
    api.weightage = async () => []
    const bidding = useBiddingStore(); await bidding.load()
    bidding.setBid('IS216', 10.1); bidding.setBid('IS111', 10.2)
    assert.notEqual(bidding.allocated, 20.3, 'fixture reproduces the floating-point display issue')
    const html = await renderToString(createSSRApp(Sidebar).use(pinia))
    assert.match(html, /e\$ 20\.30/)
    assert.doesNotMatch(html, /20\.299999/)
    assert.equal(bidding.bids.IS216, 10.1, 'formatting must not change entered bids')
  } finally { await server.close() }
})
