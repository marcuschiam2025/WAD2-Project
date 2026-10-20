import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

const memory = () => {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
}

test('session changes clear private quiz state and discard late history/submission responses', async () => {
  globalThis.localStorage = memory()
  globalThis.sessionStorage = memory()
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useQuizStore } = await server.ssrLoadModule('/src/core/stores/quiz.js')
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore()
    user.signIn()
    const quiz = useQuizStore()
    quiz.attempts = [{ id: 'private-result' }]
    quiz.answers = { I1: '5' }
    quiz.hasDraft = true
    let resolveHistory
    api.quizQuestionsV2 = async () => ({ questions: [], rubricVersion: 'v2-draft' })
    api.quizAttemptsV2 = () => new Promise((resolve) => { resolveHistory = resolve })
    const loading = quiz.initialize()
    user.signOut()
    assert.deepEqual(quiz.attempts, [])
    assert.deepEqual(quiz.answers, {})
    assert.equal(quiz.hasDraft, false)
    resolveHistory([{ id: 'late-private-result' }])
    await loading
    assert.deepEqual(quiz.attempts, [])
    user.signIn()
    let resolveSubmission
    api.submitQuizV2 = () => new Promise((resolve) => { resolveSubmission = resolve })
    const submitting = quiz.submit()
    user.profile.email = 'another.student@smu.edu.sg'
    resolveSubmission({ id: 'previous-account-result' })
    assert.equal(await submitting, null)
    assert.deepEqual(quiz.attempts, [])
    assert.equal(quiz.submitting, false)
  } finally {
    await server.close()
  }
})
