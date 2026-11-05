import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { renderToString } from 'vue/server-renderer'

const questions = [
  { id: 'I1', type: 'rating', section: 'interests', prompt: 'Rating', options: ['1', '2', '4', '5'].map(id => ({ id, label: id })) },
  { id: 'I2', type: 'scenario', section: 'interests', prompt: 'Scenario', options: ['a', 'b', 'c', 'd'].map(id => ({ id, label: id })) },
]

for (const existing of [false, true]) test(`quiz load retry ${existing ? 'restores an existing' : 'starts a new'} draft and keeps answers and option order after reload`, async () => {
  const entries = new Map(), key = 'bidmaxxer:quiz:v2:student@smu.edu.sg'
  globalThis.sessionStorage = { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v), removeItem: k => entries.delete(k) }
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  if (existing) entries.set(key, JSON.stringify({ rubricVersion: 'test', answers: { I1: '2', I2: 'b' }, current: 1, optionOrders: { I2: ['d', 'c', 'b', 'a'] }, submissionId: 'saved-attempt' }))
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: Attempt } = await server.ssrLoadModule('/src/views/QuizAttemptView.vue')
    const { useQuizStore } = await server.ssrLoadModule('/src/core/stores/quiz.js')
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    const pinia = createPinia(); setActivePinia(pinia)
    const user = useUserStore(); user.isSignedIn = true; user.profile.email = 'student@smu.edu.sg'
    const quiz = useQuizStore()
    let offline = true
    api.quizQuestionsV2 = async () => { if (offline) throw new Error('Offline'); return { rubricVersion: 'test', questions } }
    api.quizAttemptsV2 = async () => []
    let view
    const Wrapped = { ...Attempt, setup(props, context) { view = Attempt.setup(props, context); return view } }
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: Wrapped }] })
    await router.push('/quiz/attempt')
    await renderToString(createSSRApp(Wrapped).use(pinia).use(router))
    assert.equal(typeof view.loadAttempt, 'function')
    await view.loadAttempt()
    assert.ok(quiz.error)
    assert.equal(quiz.hasDraft, false, 'a failed load must not start an empty or incomplete attempt')

    offline = false
    await view.loadAttempt()
    assert.equal(quiz.error, '')
    assert.equal(quiz.hasDraft, true)
    if (existing) {
      assert.deepEqual({ ...quiz.answers }, { I1: '2', I2: 'b' })
      assert.equal(quiz.current, 1)
      assert.deepEqual(quiz.optionsFor(questions[1]).map(o => o.id), ['d', 'c', 'b', 'a'])
    }
    quiz.current = 0; quiz.answer('4')
    quiz.current = 1; quiz.answer('d')
    const saved = entries.get(key)
    assert.deepEqual(JSON.parse(saved).answers, { I1: '4', I2: 'd' })
    assert.equal(JSON.parse(saved).optionOrders.I2.length, 4)
    await view.loadAttempt()
    assert.equal(entries.get(key), saved, 'retrying must not reset an active draft')

    setActivePinia(createPinia())
    const restoredUser = useUserStore(); restoredUser.isSignedIn = true; restoredUser.profile.email = 'student@smu.edu.sg'
    const restored = useQuizStore(); await restored.initialize()
    assert.equal(restored.hasDraft, true)
    assert.deepEqual({ ...restored.answers }, { I1: '4', I2: 'd' })
    assert.equal(restored.current, 1)
    assert.deepEqual(restored.optionsFor(questions[1]).map(o => o.id), JSON.parse(saved).optionOrders.I2)
  } finally { await server.close() }
})
