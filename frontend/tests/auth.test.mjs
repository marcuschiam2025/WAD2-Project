import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
const memory = () => {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}
test('auth restores profile, refreshes tokens, rejects stale writes and clears private stores', async () => {
  globalThis.localStorage = memory()
  globalThis.sessionStorage = memory()
  localStorage.setItem('bidmaxxer:user', JSON.stringify({ isSignedIn: true, onboarded: true }))
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  const originalFetch = globalThis.fetch
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useBiddingStore } = await server.ssrLoadModule('/src/core/stores/bidding.js')
    const { authClient } = await server.ssrLoadModule('/src/core/services/firebase.js')
    const { useCatalogueStore } = await server.ssrLoadModule('/src/core/stores/catalogue.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    authClient.observe = async callback => { callback(null) }
    authClient.signOut = async () => {}
    let tokens = 0
    authClient.signIn = async () => ({ uid: 'student-a', getIdToken: async () => `fresh-${++tokens}` })
    const requests = []
    globalThis.fetch = async (_url, options) => {
      requests.push(options)
      return { ok: true, status: 200, json: async () => ({ email: 'a@smu.edu.sg', name: 'Student A', onboarded: true, intakeYear: 2025, completedModules: ['IS111'], balance: 99 }) }
    }
    setActivePinia(createPinia())
    const user = useUserStore()
    assert.equal(user.isSignedIn, false)
    await user.initialize()
    await user.signIn()
    assert.equal(user.uid, 'student-a')
    assert.equal(user.onboarded, true)
    assert.deepEqual(user.profile.completed, ['IS111'])
    await api.me()
    assert.equal(requests[0].headers.Authorization, 'Bearer fresh-1')
    assert.equal(requests[1].headers.Authorization, 'Bearer fresh-2')
    assert.equal(requests[0].headers['x-dev-uid'], undefined)
    const planner = usePlannerStore(), bidding = useBiddingStore()
    planner.plans = [{ id: 'old-plan', tracks: [], currentSem: 'Y1S1', semesters: [] }]
    planner.activePlanId = 'old-plan'
    planner.basket = ['IS424']
    bidding.setBid('IS424', 50)
    useCatalogueStore().load = async () => {}
    let finishPlans
    api.plans = () => new Promise(resolve => { finishPlans = resolve })
    const loadingPlans = planner.load()
    await Promise.resolve()
    let finishSave
    api.updateMe = () => new Promise(resolve => { finishSave = resolve })
    const saving = user.completeOnboarding({ intakeYear: 2025 })
    await user.signOut()
    finishPlans([{ _id: 'late-private-plan', tracks: [], semesters: [] }])
    await loadingPlans
    finishSave({ email: 'a@smu.edu.sg', onboarded: true })
    await assert.rejects(saving, /account changed/)
    assert.equal(user.isSignedIn, false)
    assert.equal(user.profile.email, '')
    assert.deepEqual(planner.plans, [])
    assert.deepEqual(planner.basket, [])
    assert.deepEqual(bidding.bids, {})
    assert.equal(bidding.savedAt, null)
  } finally { globalThis.fetch = originalFetch; await server.close() }
})
