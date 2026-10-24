import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b }); return { promise, resolve, reject } }
test('basket writes are ordered, recover after failure and ignore the previous account', async () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useCatalogueStore } = await server.ssrLoadModule('/src/core/stores/catalogue.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore()
    user.uid = 'student-a'; user.isSignedIn = true; user.onboarded = true
    const planner = usePlannerStore()
    planner.online = true
    const requests = []
    api.updateMe = ({basket}) => {
      const response = deferred()
      requests.push({ basket, ...response })
      return response.promise
    }
    planner.addToBasket('IS424')
    const saving = planner.saveBasket()
    await Promise.resolve()
    assert.deepEqual(requests[0].basket, ['IS424'])
    planner.addToBasket('IS424')
    planner.addToBasket('IS425')
    assert.equal(requests.length, 1, 'writes must not race')
    requests[0].resolve({basket:['IS424']})
    await Promise.resolve(); await Promise.resolve()
    assert.deepEqual(requests[1].basket, ['IS424','IS425'])
    requests[1].resolve({basket:['IS424','IS425']})
    await saving
    assert.deepEqual(user.profile.basket, ['IS424','IS425'])
    assert.equal(planner.basketSaving, false)
    planner.removeFromBasket('IS424')
    const failed = planner.saveBasket()
    await Promise.resolve()
    requests[2].reject(new Error('Server unavailable'))
    await assert.rejects(failed, /Server unavailable/)
    assert.match(planner.basketError, /Server unavailable/)
    // A network failure may happen after the server saved. Even reverting to the
    // previous local snapshot must force a retry to reconcile uncertain server state.
    planner.basket = ['IS424','IS425']
    const retry = planner.saveBasket()
    await Promise.resolve()
    assert.deepEqual(requests[3].basket, ['IS424','IS425'])
    requests[3].resolve({basket:['IS424','IS425']})
    await retry
    assert.equal(planner.basketError, '')
    planner.addToBasket('IS426')
    const stale = planner.saveBasket()
    await Promise.resolve()
    user.uid = 'student-b'
    user.profile = { email:'b@smu.edu.sg', basket:[] }
    requests[4].resolve({basket:['IS425','IS426']})
    await stale
    assert.deepEqual(planner.basket, [])
    assert.deepEqual(user.profile.basket, [])
    // A fresh app restores the persisted basket without writing it back unnecessarily.
    setActivePinia(createPinia())
    const restoredUser = useUserStore()
    restoredUser.uid = 'student-a'; restoredUser.isSignedIn = true; restoredUser.onboarded = true
    restoredUser.profile.basket = ['IS425']
    const restored = usePlannerStore()
    useCatalogueStore().load = async () => {}
    api.plans = async () => [{ _id:'saved-plan', tracks:[], currentSem:'Y1S1', semesters:[] }]
    await restored.load()
    assert.deepEqual(restored.basket, ['IS425'])
    assert.equal(requests.length, 5, 'restoration does not issue a basket update')
  } finally { await server.close() }
})
