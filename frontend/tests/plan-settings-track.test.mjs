import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { renderToString } from 'vue/server-renderer'

test('plan settings offers "Not decided" as the 1st track, and a 2nd track only once a 1st is chosen', async () => {
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: PlanSettings } = await server.ssrLoadModule('/src/components/modals/PlanSettingsModal.vue')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const render = async (tracks) => {
      const pinia = createPinia(); setActivePinia(pinia)
      const planner = usePlannerStore()
      planner.plans = [{ id: 'p', name: 'Plan', tracks, currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', label: 'Y1S1', modules: [] }] }]
      planner.activePlanId = 'p'
      const ctx = {}
      const html = await renderToString(createSSRApp(PlanSettings).use(pinia), ctx)
      return html + Object.values(ctx.teleports ?? {}).join('')
    }
    const undecided = await render([])
    assert.match(undecided, /Not decided/)
    assert.doesNotMatch(undecided, /2nd track/)
    const decided = await render(['BA'])
    assert.match(decided, /Not decided/)
    assert.match(decided, /2nd track/)
  } finally { await server.close() }
})
