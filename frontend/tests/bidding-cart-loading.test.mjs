import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'

async function fixture(t) {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  t.after(() => server.close())
  const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
  const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
  const { useBiddingStore } = await server.ssrLoadModule('/src/core/stores/bidding.js')
  const { api } = await server.ssrLoadModule('/src/core/services/api.js')
  const pinia = createPinia(); setActivePinia(pinia)
  const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true; user.balance = 100
  const planner = usePlannerStore()
  planner.plans = ['p1', 'p2'].map(id => ({ id, tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', modules: ['IS216'] }] }))
  planner.activePlanId = 'p1'; planner.online = true
  api.round = async () => ({ term: '2026-27_T2' })
  api.sections = async () => ['G1', 'G2'].map(section => ({ id: `IS216-${section}`, module: 'IS216', section, sessions: [] }))
  api.bidHistory = async () => []; api.weightage = async () => []
  api.cart = async () => ({ items: [] })
  const writes = []
  api.saveCart = async payload => { writes.push(payload) }
  const bidding = useBiddingStore()
  const { default: Sidebar } = await server.ssrLoadModule('/src/components/BidSidebar.vue')
  const saveButton = async () => (await renderToString(createSSRApp(Sidebar).use(pinia))).match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find(button => button.includes('Save plan'))
  return { api, bidding, user, writes, saveButton }
}

test('failed saved-cart reads block writes until a successful retry restores the saved choices', async t => {
  const { api, bidding, writes, saveButton } = await fixture(t)
  api.cart = async () => { throw new Error('Saved cart could not be loaded') }
  await bidding.load()
  assert.equal(await bidding.save(), false, 'defaults must never replace a cart that failed to load')
  assert.equal(writes.length, 0)
  assert.equal(bidding.cartReady, false)
  assert.match(await saveButton(), / disabled(?:[=>\s])/)
  assert.match(bidding.saveError, /load/i)

  api.cart = async () => ({ items: [{ module: 'IS216', sectionId: 'IS216-G2', amount: 50 }] })
  await bidding.load()
  assert.equal(bidding.cartReady, true)
  assert.doesNotMatch(await saveButton(), / disabled(?:[=>\s])/)
  assert.equal(await bidding.save(), true)
  assert.deepEqual(writes[0].items, [{ module: 'IS216', sectionId: 'IS216-G2', amount: 50 }])
})

test('a pending plan or term switch cannot reuse another cart readiness, while a loaded empty cart can save', async t => {
  const { api, bidding, user, writes, saveButton } = await fixture(t)
  await bidding.load()
  assert.equal(await bidding.save(), true, 'a successfully loaded empty cart allows new default bids')
  writes.length = 0
  let release, started
  const gate = new Promise(resolve => { release = resolve })
  const reading = new Promise(resolve => { started = resolve })
  api.cart = async () => { started(); await gate; return { items: [{ module: 'IS216', sectionId: 'IS216-G2', amount: 40 }] } }
  bidding.planId = 'p2'
  await reading
  assert.equal(await bidding.save(), false, 'switching plans must block saves until its own cart has loaded')
  assert.equal(writes.length, 0)
  assert.match(await saveButton(), / disabled(?:[=>\s])/)
  release()
  await bidding.load()
  assert.equal(await bidding.save(), true)
  assert.equal(writes[0].planId, 'p2')
  assert.equal(writes[0].items[0].amount, 40)

  api.round = async () => ({ term: '2027-28_T1' })
  api.cart = async () => { throw new Error('New term unavailable') }
  await bidding.load()
  assert.equal(bidding.cartReady, false, 'readiness from the previous term must not survive')
  assert.equal(await bidding.save(), false)
  assert.equal(writes.length, 1)
  user.uid = 'b'
  await nextTick()
  assert.equal(bidding.cartReady, false, 'account changes also clear readiness')
})
