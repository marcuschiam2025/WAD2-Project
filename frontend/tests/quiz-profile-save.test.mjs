import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

test('saving the profile (the balance, say) keeps the quiz results; a different account clears them', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { useQuizStore } = await server.ssrLoadModule('/src/core/stores/quiz.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore()
    const me = { _id: 'u1', email: 'a@smu.edu.sg', name: 'A', balance: 210, onboarded: true }
    api.updateMe = async (changes) => ({ ...me, ...changes })
    user.apply?.(me)
    user.uid = 'u1'; user.isSignedIn = true
    user.profile = { ...user.profile, email: me.email }
    const quiz = useQuizStore()
    await nextTick()
    quiz.attempts = [{ id: 'x', results: [] }]

    await user.save({ balance: 150 })
    await nextTick()
    assert.equal(user.balance, 150)
    assert.equal(quiz.attempts.length, 1, 'a profile save is not a new session')

    await user.save({ markedDone: ['IS111'] })
    await nextTick()
    assert.equal(quiz.attempts.length, 1)

    user.profile = { ...user.profile, email: 'someone-else@smu.edu.sg' }
    await nextTick()
    assert.equal(quiz.attempts.length, 0, 'another account starts clean')
  } finally { await server.close() }
})
