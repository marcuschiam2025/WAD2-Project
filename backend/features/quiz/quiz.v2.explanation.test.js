import test from 'node:test'
import assert from 'node:assert/strict'
import { createExplanationV2 } from './quiz.v2.explanation.js'
import { AiError } from '../../services/gemini.js'
import { EXPLANATION_VERSION } from './utils/explainResultV2.js'

const ID = '64b000000000000000000001'
const result = (track, rank) => ({ track, rank, alignmentIndex: 90 - rank * 10 })
const attempt = (results, extra = {}) => ({ _id: ID, results, resultSnapshot: { rankingBasis: 'blended', results, themeRatings: {}, answerLabels: [] }, ...extra })
const twoLeading = () => attempt([result('BA', 1), result('PD', 2), result('FT', 3)])

function response() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this },
    set(key, value) { this.headers[key] = value; return this },
    json(body) { this.body = body; return this },
  }
}

// Runs the handler with fakes and records what it saved and how often Gemini was called
async function run({ found = twoLeading(), output, error, id = ID } = {}) {
  const calls = { generate: 0, saved: [] }
  const handler = createExplanationV2(
    async (filter) => { calls.filter = filter; return found },
    async (attemptId, aiExplanation) => { calls.saved.push({ attemptId, aiExplanation }) },
    async () => { calls.generate++; if (error) throw error; return output },
    () => 'test-model',
  )
  const res = response()
  await handler({ params: { id }, user: { _id: 'user-1' } }, res)
  return { res, calls }
}

test('rejects bad IDs, other users\' attempts and legacy attempts before calling Gemini', async () => {
  const bad = await run({ id: 'nope' })
  assert.equal(bad.res.statusCode, 400)
  assert.equal(bad.res.body.code, 'INVALID_ATTEMPT_ID')

  const missing = await run({ found: null })
  assert.equal(missing.res.statusCode, 404)
  assert.deepEqual(missing.calls.filter, { _id: ID, user: 'user-1' })

  const legacy = await run({ found: { _id: ID, results: [result('BA', 1)] } })
  assert.equal(legacy.res.statusCode, 409)
  assert.equal(legacy.res.body.code, 'LEGACY_QUIZ_ATTEMPT')

  for (const { calls } of [bad, missing, legacy]) assert.equal(calls.generate, 0)
})

test('returns a saved explanation without calling Gemini again', async () => {
  const aiExplanation = { summary: 'Saved', tracks: [{ track: 'BA', reasoning: 'Because' }], model: 'm', version: EXPLANATION_VERSION, generatedAt: '2026-11-01T00:00:00.000Z' }
  const { res, calls } = await run({ found: { ...twoLeading(), aiExplanation } })
  assert.deepEqual(res.body, aiExplanation)
  assert.equal(calls.generate, 0)
  assert.equal(calls.saved.length, 0)
})

test('writes an explanation saved under an older prompt again', async () => {
  const stale = { summary: 'Your match is 78', tracks: [{ track: 'BA', reasoning: 'Old' }], model: 'm', generatedAt: '2026-11-01T00:00:00.000Z' }
  const { res, calls } = await run({ found: { ...twoLeading(), aiExplanation: stale }, output: { summary: 'New', tracks: [{ track: 'BA', reasoning: 'Fresh' }] } })
  assert.equal(calls.generate, 1)
  assert.equal(res.body.summary, 'New')
  assert.equal(res.body.version, EXPLANATION_VERSION)
  assert.equal(calls.saved.length, 1)
})

test('two leading tracks: keeps both in rank order, drops other tracks, saves once', async () => {
  const output = { summary: ' Overall ', tracks: [{ track: 'FT', reasoning: 'not leading' }, { track: 'PD', reasoning: 'Second' }, { track: 'BA', reasoning: ' First ' }] }
  const { res, calls } = await run({ output })
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['Cache-Control'], 'no-store')
  assert.equal(res.body.summary, 'Overall')
  assert.deepEqual(res.body.tracks, [{ track: 'BA', reasoning: 'First' }, { track: 'PD', reasoning: 'Second' }])
  assert.equal(res.body.model, 'test-model')
  assert.ok(!Number.isNaN(Date.parse(res.body.generatedAt)))
  assert.equal(calls.saved.length, 1)
  assert.deepEqual(calls.saved[0], { attemptId: ID, aiExplanation: res.body })
})

test('one leading track: keeps only that track', async () => {
  const output = { summary: 'Overall', tracks: [{ track: 'SMT', reasoning: 'Only one' }, { track: 'BA', reasoning: 'invented' }] }
  const { res } = await run({ found: attempt([result('SMT', 1)]), output })
  assert.deepEqual(res.body.tracks, [{ track: 'SMT', reasoning: 'Only one' }])
})

test('two leading tracks but Gemini explains one: shows the one that came back', async () => {
  const { res } = await run({ output: { summary: 'Overall', tracks: [{ track: 'PD', reasoning: 'Second' }] } })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body.tracks, [{ track: 'PD', reasoning: 'Second' }])
})

test('every Gemini failure returns a fallback status and saves nothing', async () => {
  const cases = [
    [{ error: new AiError('AI_UNAVAILABLE', 'no key') }, 503, 'AI_UNAVAILABLE', false],
    [{ error: new AiError('AI_BUSY', '429') }, 503, 'AI_BUSY', true],
    [{ error: new AiError('AI_TIMEOUT', 'slow') }, 504, 'AI_TIMEOUT', true],
    [{ error: new AiError('AI_FAILED', 'blocked') }, 502, 'AI_FAILED', true],
    [{ output: { summary: '', tracks: [{ track: 'BA', reasoning: 'x' }] } }, 502, 'AI_FAILED', true],
    [{ output: { summary: 'Overall', tracks: [{ track: 'FT', reasoning: 'not leading' }] } }, 502, 'AI_FAILED', true],
    [{ output: null }, 502, 'AI_FAILED', true],
  ]
  const logged = console.error
  console.error = () => {}
  try {
    for (const [input, status, code, retryable] of cases) {
      const { res, calls } = await run(input)
      assert.equal(res.statusCode, status, code)
      assert.deepEqual(res.body, { error: 'AI explanation is unavailable', code, retryable })
      assert.equal(calls.saved.length, 0)
    }
  } finally { console.error = logged }
})

test('unexpected errors are not hidden as AI failures', async () => {
  await assert.rejects(run({ error: new Error('database down') }), /database down/)
})
