import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

async function setup(run) {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useCatalogueStore } = await server.ssrLoadModule('/src/core/stores/catalogue.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore()
    user.uid = 'student'; user.isSignedIn = true; user.onboarded = true
    user.profile = { major: 'Information Systems', intakeYear: 2025, tracks: ['BA'], takenBySem: {}, basket: ['IS419'] }
    const catalogue = useCatalogueStore()
    catalogue.online = true
    catalogue.majors = [{ _id: 'BSC-IS_AY2025', name: 'Information Systems', intakeFrom: 2025, requirementsAvailable: true }]
    catalogue.load = async () => {}
    api.majorRequirements = async majorId => ({ majorId, requirementsAvailable: true, requirements: [], tracks: [] })
    await run({ user, catalogue, planner: usePlannerStore(), api })
  } finally { await server.close() }
}

const record = (id, majorId = null) => ({
  _id: id, name: 'My plan', majorId, tracks: [], currentSem: 'Y3S1',
  semesters: [{ id: 'Y2S2', modules: ['IS212'] }, { id: 'Y3S1', modules: ['IS216'] }, { id: 'Y3S2', exchange: true, modules: ['CS412 → IS460'] }],
})

test('missing plan curriculum is repaired and persists without changing placements or existing curricula', async () => setup(async ({ planner, api, checks, user }) => {
  const stored = [record('missing'), record('existing', 'OTHER_INTAKE')]
  const original = structuredClone(stored)
  const writes = []
  api.plans = async () => structuredClone(stored)
  api.updatePlan = async (id, body) => {
    writes.push({ id, body: structuredClone(body) })
    const plan = stored.find(p => p._id === id)
    Object.assign(plan, body)
    return structuredClone(plan)
  }
  await planner.load()
  assert.equal(planner.activePlan.majorId, 'BSC-IS_AY2025')
  assert.deepEqual(writes, [{ id: 'missing', body: { majorId: 'BSC-IS_AY2025' } }])
  assert.deepEqual(stored[0], { ...original[0], majorId: 'BSC-IS_AY2025' })
  assert.deepEqual(stored[1], original[1])
  assert.deepEqual(user.profile.basket, ['IS419'])
  await planner.reload()
  assert.equal(planner.activePlan.majorId, 'BSC-IS_AY2025')
  assert.equal(writes.length, 1, 'a persisted repair is not repeated')
}))

test('catalogue failure prevents first-plan creation and reload retries safely', async () => setup(async ({ catalogue, planner, api }) => {
  catalogue.online = false
  let creations = 0
  api.plans = async () => []
  api.createPlan = async body => { creations++; return { ...record('new'), ...body } }
  await planner.load()
  assert.equal(creations, 0, 'a failed catalogue must not create a plan with a null curriculum')
  assert.equal(planner.online, false)
  assert.match(planner.syncError, /catalogue/i)
  assert.equal(planner.checklist.unavailable, true, 'a failed catalogue must not read as nothing cleared')
  assert.match(planner.checklist.unavailableReason, /catalogue/i)
  catalogue.online = true
  await planner.reload()
  assert.equal(creations, 1)
  assert.equal(planner.activePlan.majorId, 'BSC-IS_AY2025')
  assert.equal(planner.syncError, '')
}))

test('unsupported intakes and unavailable requirements stay unavailable or guessed repairs', async () => setup(async ({ catalogue, user, planner, api }) => {
  user.profile.intakeYear = 2024
  catalogue.majors.push({ _id: 'UNAVAILABLE', name: 'Another major', intakeFrom: 2025, requirementsAvailable: false })
  api.plans = async () => [record('unsupported'), record('unavailable', 'UNAVAILABLE')]
  api.updatePlan = async () => assert.fail('no matching curriculum: do not repair')
  await planner.load()
  assert.equal(planner.online, true)
  assert.equal(planner.activePlan.majorId, null)
  assert.equal(planner.checklist.unavailable, true)
  planner.plans[0].semesters[1].modules.push('IS111')
  api.updatePlan = async () => ({})
  await planner.savePlans()
}))

test('failed curriculum repair remains retryable without changing the saved plan', async () => setup(async ({ planner, api }) => {
  const stored = record('missing')
  api.plans = async () => [structuredClone(stored)]
  api.updatePlan = async () => { throw new Error('Repair could not be saved') }
  await planner.load()
  assert.equal(planner.online, false)
  assert.match(planner.syncError, /could not be saved/)
  assert.equal(stored.majorId, null)
  api.updatePlan = async (_id, body) => Object.assign(stored, body)
  await planner.reload()
  assert.equal(planner.activePlan.majorId, 'BSC-IS_AY2025')
  assert.equal(planner.online, true)
}))

test('account changes discard a pending repair and stop subsequent writes for the old account', async () => setup(async ({ user, planner, api }) => {
  api.plans = async () => [record('first'), record('second')]
  let finish, started
  const writing = new Promise(resolve => { started = resolve })
  const pending = new Promise(resolve => { finish = resolve })
  const writes = []
  api.updatePlan = (id, body) => { writes.push(id); started(); return pending.then(() => ({ ...record(id), ...body })) }
  const loading = planner.load()
  // Bound this wait so the missing repair fails as an assertion rather than hanging.
  await Promise.race([writing, loading])
  assert.deepEqual(writes, ['first'])
  user.uid = 'another-student'
  finish()
  await loading
  assert.deepEqual(writes, ['first'])
  assert.deepEqual(planner.plans, [])
  assert.equal(planner.online, false)
  assert.equal(planner.syncError, '')
}))
