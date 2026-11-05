import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { renderToString } from 'vue/server-renderer'

const term = '2026-27_T2'
const mods = ['IS111', 'IS112', 'IS113', 'IS114', 'IS115', 'IS210']
const roomMods = ['IS211', 'IS212', 'IS213']

async function setup() {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  const load = (p) => server.ssrLoadModule(p)
  const { useUserStore } = await load('/src/core/stores/user.js')
  const { usePlannerStore } = await load('/src/core/stores/planner.js')
  const { useBiddingStore } = await load('/src/core/stores/bidding.js')
  const { useRoomsStore } = await load('/src/core/stores/rooms.js')
  const { api } = await load('/src/core/services/api.js')
  setActivePinia(createPinia())
  const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true; user.balance = 500
  const planner = usePlannerStore()
  planner.plans = [{ id: 'p', name: 'Plan 1', tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', modules: [...mods] }] }]
  planner.activePlanId = 'p'; planner.online = true
  api.round = async () => ({ term })
  api.sections = async (codes) => codes.map((module) => ({ id: `${term}:${module}:G1`, module, section: 'G1', sessions: [] }))
  api.bidHistory = async () => []; api.weightage = async () => []; api.cart = async () => ({ items: [] }); api.dropFromCart = async () => {}
  const writes = []
  api.saveCart = async (payload) => { writes.push(payload) }
  const rooms = useRoomsStore()
  const lockRooms = (codes) => { rooms.rooms = codes.map((module, i) => ({ id: `r${i}`, name: `Room ${module}`, module, term, lockedSection: `${term}:${module}:G1`, members: ['me'], admins: [], votes: {} })) }
  return { server, user, planner, bidding: useBiddingStore(), rooms, lockRooms, writes, load }
}

test('rooms can push the bid cart past a semester\'s six modules; saving is refused until one is removed', async () => {
  const { server, bidding, planner, lockRooms, writes } = await setup()
  try {
    await bidding.load()
    assert.equal(bidding.inCart.length, 6)
    assert.equal(bidding.overLimit, 0, 'six is allowed')
    assert.equal(await bidding.save(), true)

    lockRooms(roomMods.slice(0, 1))
    await bidding.load()
    assert.equal(bidding.inCart.length, 7, 'a locked room adds its module on its own')
    assert.equal(bidding.overLimit, 1)
    assert.equal(await bidding.save(), false)
    assert.match(bidding.saveError, /7 modules.*at most 6.*Remove 1/)
    assert.equal(writes.length, 1, 'an over-limit cart never reaches the API')

    lockRooms(roomMods)
    await bidding.load()
    assert.equal(bidding.overLimit, 3, 'several rooms: three too many')
    assert.match((await bidding.save(), bidding.saveError), /Remove 3/)

    // A module a room locked cannot be dropped from the cart, so it does not help
    bidding.dropModule('IS211')
    assert.equal(bidding.overLimit, 3)

    // Taking plan modules out of the plan fixes it, for the plan being bid for, and keeps them in the basket
    planner.returnToBasketFrom('p', 'IS111')
    planner.returnToBasketFrom('p', 'IS112')
    planner.returnToBasketFrom('p', 'IS113')
    assert.equal(bidding.inCart.length, 6)
    assert.equal(bidding.overLimit, 0)
    assert.deepEqual(['IS111', 'IS112', 'IS113'].filter((code) => planner.basket.includes(code)), ['IS111', 'IS112', 'IS113'])
    assert.equal(planner.plans[0].semesters[1].modules.length, 3)
    assert.equal(await bidding.save(), true)
    assert.equal(writes.length, 2)
    assert.equal(writes[1].items.length, 6)
  } finally { await server.close() }
})

test('returnToBasketFrom works on a plan that is not the active one and counts an exchange entry as its module', async () => {
  const { server, planner } = await setup()
  try {
    planner.plans = [
      { id: 'p', name: 'A', tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', modules: ['IS111'] }] },
      { id: 'q', name: 'B', tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', modules: ['CS412 → IS460', 'IS111'] }] },
    ]
    planner.activePlanId = 'p'
    planner.returnToBasketFrom('q', 'IS460')
    assert.deepEqual(planner.plans[1].semesters[1].modules, ['IS111'])
    assert.deepEqual(planner.plans[0].semesters[1].modules, ['IS111'], 'the active plan is untouched')
    assert.equal(planner.basket.filter((code) => code === 'IS460').length, 1)
    planner.returnToBasketFrom('q', 'IS460')
    assert.equal(planner.basket.filter((code) => code === 'IS460').length, 1, 'no duplicate in the basket')
  } finally { await server.close() }
})

test('the prompt lists every module, offers Remove on plan modules and Open room on locked ones', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: BidLimitModal } = await server.ssrLoadModule('/src/components/modals/BidLimitModal.vue')
    const render = async (props) => {
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }, { path: '/rooms/:id', component: { render: () => null } }] })
      await router.push('/')
      const context = {}
      await renderToString(createSSRApp(BidLimitModal, props).use(router), context)
      return context.teleports.body
    }
    const rows = [{ code: 'IS111', name: 'Programming', roomId: null }, { code: 'IS211', name: 'Design', roomId: 'r0', roomName: 'OOP gang' }]
    let html = await render({ count: 7, max: 6, planName: 'Plan 1', rows })
    assert.match(html, /7 modules is too many/)
    assert.match(html, /at most 6 modules.*7.*Remove one/s)
    assert.match(html, /aria-label="Remove IS111 from Plan 1"/)
    assert.doesNotMatch(html, /Remove IS211/, 'a locked module has no Remove button')
    assert.match(html, /Locked by OOP gang/)
    assert.match(html, /href="\/rooms\/r0"/)
    assert.match(html, /Decide later/)
    assert.match(html, /can only be freed by leaving that room/)

    html = await render({ count: 8, max: 6, planName: 'Plan 1', rows: [{ code: 'IS211', name: 'Design', roomId: 'r0', roomName: 'OOP gang' }, { code: 'IS212', name: 'Algorithms', roomId: 'r1', roomName: 'Study group' }] })
    assert.match(html, /Remove 2/)
    assert.match(html, /Every module here is locked by a collab room/)
    assert.doesNotMatch(html, /aria-label="Remove /)
  } finally { await server.close() }
})
