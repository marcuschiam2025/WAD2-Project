import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { renderToString } from 'vue/server-renderer'

test('degree form accepts credit balances with up to two decimals and rejects extra precision', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: DegreeForm } = await server.ssrLoadModule('/src/components/DegreeForm.vue')
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    for (const balance of [0, 204, 204.5, 204.55, 0.01, 0.29, 204.555, -1]) {
      const pinia = createPinia(); setActivePinia(pinia)
      const user = useUserStore()
      user.balance = balance
      user.profile = { tracks: ['BA'], currentSem: 'Y1S1', takenBySem: {}, exempted: [], intakeYear: 2025 }
      const app = createSSRApp(DegreeForm, { mode: 'edit' }).use(pinia)
      app.directive('stagger', { getSSRProps: () => ({}) })
      const html = await renderToString(app)
      const input = html.match(/<input[^>]*step="0.01"[^>]*>/)?.[0]
      const saveButton = html.match(/<button[^>]*>Save changes/)?.[0]
      assert.ok(input)
      assert.ok(saveButton)
      assert.match(input, /step="0.01"/)
      if (balance === 204.555 || balance < 0) {
        assert.match(html, /Still to do: e-credits/)
        assert.match(saveButton, /\sdisabled(?:\s|=|>)/)
      } else {
        assert.doesNotMatch(html, /Still to do:/, `${balance} is a valid balance`)
        assert.doesNotMatch(saveButton, /\sdisabled(?:\s|=|>)/)
      }
    }
  } finally { await server.close() }
})
