import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('curriculum selection respects intake ranges and never substitutes a supported newer intake', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useCatalogueStore } = await server.ssrLoadModule('/src/core/stores/catalogue.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const catalogue = useCatalogueStore()
    catalogue.majors = [
      { _id: 'OLD', name: 'Information Systems', intakeFrom: 2020, intakeTo: 2023, requirementsAvailable: true },
      { _id: 'NEW', name: 'Information Systems', intakeFrom: 2025, intakeTo: null, requirementsAvailable: true },
      { _id: 'LATEST', name: 'Information Systems', intakeFrom: 2027, requirementsAvailable: false },
    ]
    assert.equal(catalogue.majorIdFor('Information Systems', 2023), 'OLD')
    assert.equal(catalogue.majorIdFor('Information Systems', 2024), null, 'a gap is unsupported')
    assert.equal(catalogue.majorIdFor('Information Systems', 2019), null)
    assert.equal(catalogue.majorIdFor('Information Systems', 2026), 'NEW')
    assert.equal(catalogue.majorIdFor('Information Systems', 2027), 'LATEST', 'missing requirements must not select an older curriculum')
    for (const year of [undefined, null, '', 'invalid', 2025.5]) assert.equal(catalogue.majorIdFor('Information Systems', year), null)
    assert.equal(catalogue.majorIdFor('Unknown', 2025), null)

    const user = useUserStore()
    user.isSignedIn = true; user.onboarded = true
    user.profile = { major: 'Information Systems', intakeYear: 2023, tracks: [], takenBySem: {} }
    catalogue.online = true; catalogue.load = async () => {}
    api.plans = async () => []
    let created
    api.createPlan = async body => { created = body; return { ...body, _id: 'p', name: 'Plan' } }
    api.updatePlan = async () => ({})
    api.majorRequirements = async id => ({ majorId: id, requirementsAvailable: true, requirements: [], tracks: [] })
    const planner = usePlannerStore()
    await planner.load()
    assert.equal(created.majorId, 'OLD', 'onboarding passes the intake year')
    planner.plans[0].majorId = null
    assert.equal(planner.checklist.unavailable, true, 'no curriculum must never show sample IS requirements online')
    assert.match(planner.checklist.unavailableReason, /intake/i)
    planner.plans[0].majorId = 'LATEST'
    catalogue.curricula.LATEST = { majorId: 'LATEST', requirementsAvailable: false, requirements: [], tracks: [] }
    assert.equal(planner.checklist.unavailable, true)
    assert.match(planner.checklist.unavailableReason, /not.*available/i)
    assert.match(planner.curriculumNotice, /saved.*curriculum.*intake/i)
    assert.equal(planner.plans[0].majorId, 'LATEST', 'existing saved plans are not silently rewritten')

    const majorList = [...catalogue.majors]
    setActivePinia(createPinia())
    const unsupportedUser = useUserStore()
    unsupportedUser.isSignedIn = true; unsupportedUser.onboarded = true
    unsupportedUser.profile = { major: 'Information Systems', intakeYear: 2019, tracks: ['BA'], takenBySem: {} }
    const unsupportedCatalogue = useCatalogueStore()
    unsupportedCatalogue.majors = majorList; unsupportedCatalogue.online = true; unsupportedCatalogue.load = async () => {}
    const unsupportedPlanner = usePlannerStore()
    await unsupportedPlanner.load()
    assert.equal(created.majorId, null, 'send null explicitly so server defaults cannot substitute a newer intake')
    assert.deepEqual(created.tracks, [])
    assert.equal(unsupportedPlanner.checklist.unavailable, true)

    api.plans = async () => [{ ...created, majorId: 'NEW', tracks: [], _id: 'saved', name: 'Saved plan' }]
    await unsupportedPlanner.reload()
    assert.equal(unsupportedPlanner.activePlan.majorId, 'NEW', 'loading a saved plan retains its curriculum')
    assert.match(unsupportedPlanner.curriculumNotice, /saved.*curriculum.*intake/i)
  } finally { await server.close() }
})
