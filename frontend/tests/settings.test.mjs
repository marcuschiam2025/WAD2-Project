import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { renderToString } from 'vue/server-renderer'

test('settings explains actual calendar access without treating legacy consent flags as live connections', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: Settings } = await server.ssrLoadModule('/src/views/SettingsView.vue')
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    for (const enabled of [false, true]) {
      const pinia = createPinia(); setActivePinia(pinia)
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/settings', component: Settings }, { path: '/bidding/finalised', component: { render: () => null } }] })
      await router.push('/settings')
      const app = createSSRApp(Settings).use(pinia).use(router)
      app.directive('enter', { getSSRProps: () => ({}) })
      app.directive('stagger', { getSSRProps: () => ({}) })
      const html = await renderToString(app)
      assert.doesNotMatch(html, /Gmail|Outlook|Disconnect|Revoke all access|Last synced|23 events added|Connected 12 Aug/)
      assert.match(html, /On-demand permission/)
      assert.match(html, /does not verify.*permission status/i)
      assert.match(html, /viewing and editing events/i, 'do not claim the Calendar scope is limited to events created by this app')
      assert.match(html, /href="\/bidding\/finalised"/)
      assert.match(html, /href="https:\/\/myaccount.google.com\/connections"/)
    }
  } finally { await server.close() }
})
