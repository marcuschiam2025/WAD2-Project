import test from 'node:test'
import assert from 'node:assert/strict'
import { listQuestionsV2, createSubmitAttemptV2 } from './quiz.v2.controller.js'
import { readFile } from 'node:fs/promises'

const content = JSON.parse(await readFile(new URL('./content/questions.v2-draft.json', import.meta.url), 'utf8'))
const submission = () => ({
  rubricVersion: 'v2.1', submissionId: 'example-1',
  answers: content.questions.map((q) => ({ questionId: q.id, optionId: q.type === 'rating' ? '5' : 'a' })),
})

function response() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this },
    set(key, value) { this.headers[key] = value; return this },
    json(body) { this.body = body; return this },
  }
}

test('v2 preview serves all questions with only public fields', () => {
  const res = response()
  listQuestionsV2({ query: {} }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.rubricVersion, 'v2.1')
  assert.equal(res.headers['Cache-Control'], 'no-store')
  assert.deepEqual(Object.keys(res.body).sort(), ['questions', 'rubricVersion'])
  assert.equal(res.body.questions.length, 20)
  assert.equal(new Set(res.body.questions.map((q) => q.id)).size, 20)
  for (const q of res.body.questions) {
    assert.deepEqual(Object.keys(q).sort(), ['id', 'options', 'order', 'prompt', 'section', 'type'])
    for (const option of q.options) assert.deepEqual(Object.keys(option).sort(), ['id', 'label'])
  }
})

test('version requests cannot silently receive a different rubric', () => {
  for (const rubricVersion of ['v2-draft', ['v2.1', 'v2-draft']]) {
    const res = response()
    listQuestionsV2({ query: { rubricVersion } }, res)
    assert.equal(res.statusCode, 409)
    assert.equal(res.body.code, 'QUIZ_VERSION_UNAVAILABLE')
    assert.equal(res.body.questions, undefined)
  }
  const res = response()
  listQuestionsV2({ query: { rubricVersion: 'v2.1' } }, res)
  assert.equal(res.statusCode, 200)
})

test('invalid submission never reaches persistence', async () => {
  const handler = createSubmitAttemptV2(() => { throw new Error('Must not save') })
  const res = response()
  await handler({ body: submission(), user: { _id: 'user-1' } , }, res)
    .then(() => assert.fail('Expected injected persistence to be reached for valid input'), (error) => assert.equal(error.message, 'Must not save'))
  const invalid = submission()
  invalid.answers[0].optionId = 'invalid'
  await handler({ body: invalid, user: { _id: 'user-1' } }, res)
  assert.equal(res.statusCode, 400)
})

test('submission saves server-calculated snapshot and excludes internal rubric from response', async () => {
  let saved
  const handler = createSubmitAttemptV2(async (input) => {
    saved = input
    return { status: 201, attempt: { ...input.document, _id: 'attempt-1', createdAt: '2026-10-20' } }
  })
  const body = submission()
  body.results = [{ track: 'FT', alignmentIndex: 999 }]
  const res = response()
  await handler({ body, user: { _id: 'user-1' } }, res)
  assert.equal(res.statusCode, 201)
  assert.equal(saved.user, 'user-1')
  assert.equal(saved.document.rubricSnapshot.RUBRIC_VERSION, 'v2.1')
  assert.equal(res.body.rubricSnapshot, undefined)
  assert.equal(res.body.results[0].track, 'BA', 'every rating level, every scenario on BA')
  assert.ok(res.body.results.every((result) => result.alignmentIndex !== 999))
  assert.equal(res.body.answerLabels.length, 20)
  assert.equal(res.body.rankingBasis, 'blended')
  const fingerprint = saved.fingerprint
  body.answers.reverse()
  await handler({ body, user: { _id: 'user-1' } }, response())
  assert.equal(saved.fingerprint, fingerprint)
})

test('a blank answer never reaches persistence, and conflict/replay outcomes are represented correctly', async () => {
  const blank = submission()
  blank.answers[0].optionId = null
  const refused = response()
  await createSubmitAttemptV2(() => { throw new Error('Must not save') })({ body: blank, user: { _id: 'user-1' } }, refused)
  assert.equal(refused.statusCode, 422)
  assert.equal(refused.body.code, 'QUIZ_INCOMPLETE')

  const body = submission()
  const handler = createSubmitAttemptV2(async ({ document }) => {
    assert.equal(document.rankingBasis, 'blended')
    return { status: 200, attempt: { ...document, _id: 'replayed' } }
  })
  const res = response()
  await handler({ body, user: { _id: 'user-1' } }, res)
  assert.equal(res.statusCode, 200)
  for (const [status, code] of [[409, 'SUBMISSION_ID_REUSED'], [410, 'QUIZ_RESULT_EXPIRED']]) {
    const handler = createSubmitAttemptV2(async () => ({ status, code }))
    const res = response()
    await handler({ body, user: { _id: 'user-1' } }, res)
    assert.equal(res.statusCode, status)
    assert.equal(res.body.code, code)
  }
})
