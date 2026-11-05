import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { renderToString } from 'vue/server-renderer'

const startServer = () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  return createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
}
const samplePlan = modules => ({ id: 'p', name: 'Plan 1', tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', label: 'Y1 · S2', modules }] })

test('the dashboard does not report a clean plan when the checks could not run', async () => {
  const server = await startServer()
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { default: View } = await server.ssrLoadModule('/src/views/DashboardView.vue')
    const pinia = createPinia(); setActivePinia(pinia)
    const user = useUserStore(); user.uid = 'student'; user.isSignedIn = true
    const planner = usePlannerStore()
    planner.plans = [samplePlan(['IS111'])]; planner.activePlanId = 'p'
    assert.equal(planner.checklist.unavailable, true)
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/dashboard', component: View }, { path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
    await router.push('/dashboard')
    const app = createSSRApp(View).use(pinia).use(router)
    app.directive('enter', {}); app.directive('stagger', {})
    const html = await renderToString(app)
    assert.doesNotMatch(html, /No prerequisite or\s+timing problems found/)
    assert.ok(html.includes(planner.checklist.unavailableReason), 'says why nothing was checked')
  } finally { await server.close() }
})

test('a module missing from the loaded catalogue is flagged instead of passing as having no prerequisites', async () => {
  const server = await startServer()
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useCatalogueStore } = await server.ssrLoadModule('/src/core/stores/catalogue.js')
    const { liveModules } = await server.ssrLoadModule('/src/core/data/catalogue.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'student'; user.isSignedIn = true
    const planner = usePlannerStore(), catalogue = useCatalogueStore()
    liveModules.IS111 = { _id: 'IS111', categories: [] }
    const plan = samplePlan(['IS111', 'ZZ999'])
    // While the catalogue hasn't loaded, nothing can be called unknown
    assert.equal(planner.hasWarning(plan, 'ZZ999', 'Y1S2'), false)
    catalogue.online = true
    assert.equal(planner.hasWarning(plan, 'ZZ999', 'Y1S2'), true)
    assert.match(planner.warningMessages(plan, 'ZZ999', 'Y1S2').join(), /Not in the course catalogue/)
    assert.equal(planner.hasWarning(plan, 'IS111', 'Y1S2'), false)
  } finally { await server.close() }
})

test('the room list only says ready when the server says so', async () => {
  const server = await startServer()
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { useRoomsStore } = await server.ssrLoadModule('/src/core/stores/rooms.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true; user.profile = { _id: 'a', email: 'a@smu.edu.sg' }
    const rooms = useRoomsStore()
    const listed = { _id: 'r', name: 'Friends', module: 'IS216', termKey: 't', members: [{ _id: 'a', name: 'A' }] }
    const full = { ...listed, owner: 'a', votes: [{ user: 'a', sectionIds: ['archived-section'] }] }
    api.rooms = async () => [listed]
    api.room = async () => full
    await rooms.load()
    assert.equal(rooms.getRoom('r').summary.status, 'voting', 'a raw ballot may be for a section no longer on offer')
    assert.equal(rooms.roomState(rooms.getRoom('r')).allVoted, false)
    api.room = async () => ({ ...full, summary: { memberCount: 1, votedCount: 1, allVoted: true, status: 'ready' } })
    await rooms.load()
    assert.equal(rooms.getRoom('r').summary.status, 'ready')
    assert.equal(rooms.roomState(rooms.getRoom('r')).allVoted, true)
  } finally { await server.close() }
})

test('the warning popup explains a module missing from the catalogue', async () => {
  const server = await startServer()
  try {
    const { default: Modal } = await server.ssrLoadModule('/src/components/modals/PrereqWarningModal.vue')
    const app = createSSRApp(Modal, { code: 'ZZ999', semLabel: 'Y1 · S2', unknown: true, prereqs: [], coreqs: [], prereqGroups: [], coreqGroups: [], exclusions: [], rules: [] })
    app.directive('enter', {}); app.directive('stagger', {})
    const ctx = {} // the modal renders through a Teleport
    const html = await renderToString(app, ctx)
    assert.match(html + Object.values(ctx.teleports ?? {}).join(''), /ZZ999 is not in the course catalogue/)
  } finally { await server.close() }
})
