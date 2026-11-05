import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

test('failed deletion preserves plans; management requests serialize and ignore stale account responses', async () => {
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
    const records = ['one', 'two'].map((_id, i) => ({ _id, name: `Plan ${i + 1}`, majorId: null, tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', modules: [] }] }))
    api.plans = async () => structuredClone(records)
    api.updatePlan = async () => ({})
    const planner = usePlannerStore(); await planner.load(); planner.activePlanId = 'two'
    let pending = deferred(), deletions = 0, creations = 0
    api.deletePlan = () => { deletions++; return pending.promise }
    api.createPlan = async () => { creations++; return { ...records[0], _id: 'three' } }
    const deleting = planner.deletePlan('two')
    await tick()
    assert.deepEqual(planner.plans.map(p => p.id), ['one', 'two'], 'keep plan visible until confirmed')
    assert.equal(planner.activePlanId, 'two')
    assert.equal(planner.planActionPending, true)
    await planner.deletePlan('one'); await planner.addPlan()
    assert.equal(deletions, 1); assert.equal(creations, 0)
    pending.reject(new Error('Delete refused'))
    assert.equal(await deleting, false)
    assert.equal(planner.planActionError, 'Delete refused')
    await planner.savePlans()
    assert.equal(planner.planActionError, 'Delete refused', 'autosaving must not erase a failed deletion message')
    assert.deepEqual(planner.plans.map(p => p.name), ['Plan 1', 'Plan 2'])
    assert.equal(planner.planActionPending, false)

    pending = deferred()
    const saving = deferred(), writes = []
    api.updatePlan = (id, data) => {
      writes.push({ id, data })
      return writes.length === 1 ? saving.promise : Promise.resolve({})
    }
    planner.plans[0].semesters[0].modules.push('IS111')
    const success = planner.deletePlan('one'); await tick()
    assert.equal(deletions, 1, 'wait for pending edits to save before deleting')
    saving.resolve(); await tick()
    assert.equal(deletions, 2)
    planner.plans[1].semesters[0].modules.push('IS112')
    const saveDuringDeletion = planner.savePlans(); await tick()
    assert.equal(writes.length, 1, 'do not race old plan names against server renumbering')
    pending.resolve(); assert.equal(await success, true)
    await saveDuringDeletion
    assert.deepEqual(writes[1], { id: 'two', data: { name: 'Plan 1', tracks: [], currentSem: 'Y1S1', semesters: [{ id: 'Y1S1', exchange: false, loa: false, modules: ['IS112'] }] } })
    assert.deepEqual(planner.plans.map(p => [p.id, p.name]), [['two', 'Plan 1']])
    assert.equal(planner.activePlanId, 'two', 'deleting another plan keeps the selected plan')
    assert.equal(await planner.deletePlan('two'), false, 'last plan cannot be removed')

    const creation = deferred(); api.createPlan = () => { creations++; return creation.promise }
    const adding = planner.addPlan(); await tick()
    await planner.addPlan(); assert.equal(creations, 1)
    creation.resolve({ ...records[0], _id: 'three' }); await adding
    assert.equal(planner.plans.length, 2)
    pending = deferred()
    const stale = planner.deletePlan('three'); await tick()
    user.uid = 'b'
    pending.reject(new Error('Old account error'))
    await stale
    assert.deepEqual(planner.plans, [])
    assert.equal(planner.syncError, '')
    assert.equal(planner.planActionError, '')
    assert.equal(planner.planActionPending, false)
  } finally { await server.close() }
})
