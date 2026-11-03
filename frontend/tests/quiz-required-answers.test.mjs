import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

const rating = { id: 'I1', type: 'rating', section: 'interests', options: ['1', '2', '4', '5'].map((id) => ({ id, label: id })) }
const scenario = { id: 'I2', type: 'scenario', section: 'interests', options: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, label: id })) }

test('every question must be answered, and "None of these" counts as an answer', async () => {
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { useQuizStore } = await server.ssrLoadModule('/src/core/stores/quiz.js')
    setActivePinia(createPinia())
    const quiz = useQuizStore()
    quiz.questions = [rating, scenario]
    quiz.rubricVersion = 'test'
    quiz.start()

    assert.equal(quiz.firstBlank, 0)
    quiz.answer('4')
    assert.equal(quiz.firstBlank, 1)
    quiz.current = 1
    quiz.answer('e')
    assert.equal(quiz.firstBlank, -1)
  } finally { await server.close() }
})

test('a tie is only reported as random when it runs past the two tracks shown', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { tieRunsPastShown } = await server.ssrLoadModule('/src/core/stores/quiz.js')
    const ranks = (...values) => values.map((rank) => ({ rank }))
    assert.equal(tieRunsPastShown(ranks(1, 2, 3, 4)), false, 'no tie')
    assert.equal(tieRunsPastShown(ranks(1, 1, 3, 4)), false, 'two tied at the top both fit')
    assert.equal(tieRunsPastShown(ranks(1, 1, 1, 4)), true, 'three tied at the top')
    assert.equal(tieRunsPastShown(ranks(1, 2, 2, 4)), true, 'a tie for second place')
    assert.equal(tieRunsPastShown(ranks(1, 1, 1, 1)), true, 'all four tied')
    assert.ok(!tieRunsPastShown(undefined))
  } finally { await server.close() }
})

test('rating themes read as words, and only results from before the combined score are flagged as older', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { themeLevel, isOlderResult } = await server.ssrLoadModule('/src/core/stores/quiz.js')
    assert.deepEqual([100, 67, 66, 34, 33, 0, null].map(themeLevel), ['High', 'High', 'Medium', 'Medium', 'Low', 'Low', 'No evidence yet'])
    assert.equal(isOlderResult({ rankingBasis: 'blended' }), false)
    for (const attempt of [{ rankingBasis: 'rating' }, { rankingBasis: 'scenario-provisional' }, { rubricVersion: 'legacy-v1' }]) assert.equal(isOlderResult(attempt), true)
  } finally { await server.close() }
})
