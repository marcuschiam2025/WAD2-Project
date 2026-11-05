import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { renderToString } from 'vue/server-renderer'

test('the bidding simulator trims extra decimal places from typed or pasted amounts before updating bids', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: Sidebar } = await server.ssrLoadModule('/src/components/BidSidebar.vue')
    const { useBiddingStore } = await server.ssrLoadModule('/src/core/stores/bidding.js')
    const pinia = createPinia(); setActivePinia(pinia)
    const updates = []
    useBiddingStore().setBid = (code, amount) => { updates.push({ code, amount }) }
    let bindings
    const Wrapped = { ...Sidebar, setup(props, context) { bindings = Sidebar.setup(props, context); return bindings } }
    await renderToString(createSSRApp(Wrapped, { code: 'IS216' }).use(pinia))
    assert.equal(typeof bindings.onBidInput, 'function')
    for (const [typed, displayed, stored] of [
      ['30.12345', '30.12', 30.12], ['30.129', '30.12', 30.12],
      ['30.12', '30.12', 30.12], ['30.1', '30.1', 30.1], ['30', '30', 30], ['', '', ''],
    ]) {
      const event = { target: { value: typed } }
      bindings.onBidInput(event)
      assert.equal(event.target.value, displayed, 'the displayed input must also lose extra digits')
      assert.deepEqual(updates.at(-1), { code: 'IS216', amount: stored })
    }
  } finally { await server.close() }
})
