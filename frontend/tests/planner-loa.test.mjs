import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

const ids = (plan) => plan.semesters.map((s) => `${s.id}${s.loa ? '(LOA)' : ''}`)

test('LOA additions stop at two per plan and become available again after removal', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  try {
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    setActivePinia(createPinia())
    const planner = usePlannerStore()
    planner.plans = [{ id: 'p', tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y1S2', modules: [] }] }]
    planner.activePlanId = 'p'
    planner.addSemester({ loa: true })
    planner.addSemester({ loa: true })
    const before = ids(planner.activePlan)
    planner.addSemester({ loa: true })
    assert.deepEqual(ids(planner.activePlan), before, 'a third LOA must never enter the plan or reach autosave')
    assert.equal(planner.canAddLoa, false)
    planner.removeLoa('Y2S2')
    assert.equal(planner.canAddLoa, true)
    planner.addSemester({ loa: true })
    assert.equal(planner.activePlan.semesters.filter(s => s.loa).length, 2)

    planner.plans.push({ id: 'other', tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }] })
    planner.activePlanId = 'other'
    assert.equal(planner.canAddLoa, true, 'the LOA limit belongs to each plan')
    planner.activePlan.semesters = [{ id: 'Y9S1', modules: [] }]
    planner.addSemester()
    assert.equal(planner.activePlan.semesters.at(-1).id, 'Y9S2')
    planner.addSemester({ loa: true })
    planner.addSemester()
    assert.equal(planner.activePlan.semesters.length, 2, 'neither action may create unsupported Y10 terms')
    assert.equal(planner.canAddSemester, false)
    assert.equal(planner.canAddLoa, false)
  } finally { await server.close() }
})

test('LOA terms move and delete within future terms, renumbering the terms after them', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useCatalogueStore } = await server.ssrLoadModule('/src/core/stores/catalogue.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true; user.onboarded = true
    useCatalogueStore().load = async () => {}
    const modules = { Y1S1: ['IS111'], Y1S2: ['IS112'], Y2S1: ['IS216'], Y2S2: ['IS217'] }
    const semesters = Object.entries(modules).map(([id, codes]) => ({ id, modules: codes }))
    api.plans = async () => [{ _id: 'p', name: 'Plan 1', majorId: null, tracks: [], currentSem: 'Y1S2', semesters }]
    api.checkPlan = async () => ({})
    api.updatePlan = async () => ({})
    api.updateMe = async (body) => body
    const planner = usePlannerStore(); await planner.load()
    const plan = planner.activePlan

    planner.addSemester({ loa: true })
    assert.deepEqual(ids(plan), ['Y1S1', 'Y1S2', 'Y2S1', 'Y2S2', 'Y3S1(LOA)'])

    // Move the LOA to Y2S1: it takes that number and the later terms shift along with their modules
    assert.equal(planner.moveLoa('Y3S1', 'Y2S1'), true)
    assert.deepEqual(ids(plan), ['Y1S1', 'Y1S2', 'Y2S1(LOA)', 'Y2S2', 'Y3S1'])
    assert.equal(plan.semesters[2].label, 'Y2 · S1')
    assert.deepEqual(plan.semesters[3].modules, ['IS216'])
    assert.deepEqual(plan.semesters[4].modules, ['IS217'])

    // It can never move into or before the current semester
    assert.equal(planner.canMoveLoa('Y2S1', 'Y1S2'), false)
    assert.equal(planner.moveLoa('Y2S1', 'Y1S2'), false)

    // Moving later works too
    planner.moveLoa('Y2S1', 'Y2S2')
    assert.deepEqual(ids(plan), ['Y1S1', 'Y1S2', 'Y2S1', 'Y2S2(LOA)', 'Y3S1'])
    assert.deepEqual(plan.semesters[2].modules, ['IS216'])

    // Deleting renumbers the terms after it; an internship placed in it goes back to the basket
    plan.semesters[3].modules.push('INTERN')
    planner.removeLoa('Y2S2')
    assert.deepEqual(ids(plan), ['Y1S1', 'Y1S2', 'Y2S1', 'Y2S2'])
    assert.deepEqual(plan.semesters[3].modules, ['IS217'])
    assert.ok(planner.basket.includes('INTERN'))
    assert.equal(plan.currentSem, 'Y1S2')
  } finally {
    await server.close()
  }
})
