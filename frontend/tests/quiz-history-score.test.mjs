import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { renderToString } from 'vue/server-renderer'

test('quiz history shows the leading alignment percentage without inventing provisional or missing scores', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: QuizView } = await server.ssrLoadModule('/src/views/QuizView.vue')
    const { useQuizStore } = await server.ssrLoadModule('/src/core/stores/quiz.js')
    const pinia = createPinia(); setActivePinia(pinia)
    const quiz = useQuizStore()
    quiz.attempts = [
      { id: 'rated', rubricVersion: 'v2-draft', rankingBasis: 'rating', results: [{ track: 'FT', alignmentIndex: 86.7 }] },
      { id: 'zero', rubricVersion: 'v2-draft', rankingBasis: 'rating', results: [{ track: 'BA', alignmentIndex: 0 }] },
      { id: 'provisional', rubricVersion: 'v2-draft', rankingBasis: 'scenario-provisional', results: [{ track: 'PD', alignmentIndex: null, scenarioPreferenceIndex: 92 }] },
      { id: 'legacy', rubricVersion: 'legacy-v1', results: [{ track: 'SMT', pct: 80 }] },
      { id: 'missing', rubricVersion: 'v2-draft', rankingBasis: 'rating', results: [{ track: 'BA' }] },
    ].map(attempt => ({ ...attempt, createdAt: '2026-11-01T14:00:00Z' }))
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/quiz', component: QuizView }, { path: '/quiz/results', component: { render: () => null } }] })
    await router.push('/quiz')
    const html = await renderToString(createSSRApp(QuizView).use(pinia).use(router))
    assert.match(html, /87% alignment · Financial Technology/)
    assert.match(html, /0% alignment · Business Analytics/)
    assert.match(html, /Provisional exploration · Product Development/)
    assert.match(html, /Earlier quiz format · Smart-City/)
    assert.match(html, /Alignment unavailable · Business Analytics/)
    assert.doesNotMatch(html, /Rating alignment|92%|NaN%|undefined%|null%/)
  } finally { await server.close() }
})
