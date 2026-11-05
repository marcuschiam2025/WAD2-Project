import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { renderToString } from 'vue/server-renderer'

test('bidding and dashboard show the next window as upcoming using its opening time', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useBiddingStore } = await server.ssrLoadModule('/src/core/stores/bidding.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    const pinia = createPinia(); setActivePinia(pinia)
    const user = useUserStore(); user.uid = 'student'; user.isSignedIn = true
    const planner = usePlannerStore()
    planner.plans = [{ id: 'p', name: 'Plan 1', tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', label: 'Y1 · S2', modules: [] }] }]
    planner.activePlanId = 'p'; planner.online = true
    api.round = async () => ({ term: '2099-00_T2', round: '1A', configured: true, isOpen: false, opensAt: '2099-11-04T09:00:00Z', closesAt: '2099-11-06T02:00:00Z' })
    api.cart = async () => ({ items: [] })
    const bidding = useBiddingStore(); await bidding.load()
    assert.equal(bidding.roundInfo.opensAt?.toISOString(), '2099-11-04T09:00:00.000Z')
    for (const [file, path] of [['BiddingView', '/bidding'], ['DashboardView', '/dashboard']]) {
      const { default: View } = await server.ssrLoadModule(`/src/views/${file}.vue`)
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path, component: View }, { path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
      await router.push(path)
      const app = createSSRApp(View).use(pinia).use(router)
      app.directive('enter', {}); app.directive('stagger', {})
      const html = await renderToString(app)
      assert.match(html, /Opens in /, file)
      assert.doesNotMatch(html, /Closes in |left to bid/, file)
    }
  } finally { await server.close() }
})
