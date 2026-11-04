import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateSubmissionV2 } from '../validateSubmissionV2.js'

const rubric = JSON.parse(await readFile(new URL('../content/questions.v2-draft.json', import.meta.url), 'utf8'))
const submission = () => ({
  rubricVersion: rubric.rubricVersion,
  submissionId: 'attempt-1',
  answers: rubric.questions.map((q) => ({ questionId: q.id, optionId: q.type === 'rating' ? '4' : 'a' })),
})

test('a complete submission passes, and shuffled input is normalised by ID', () => {
  const body = submission()
  body.answers.reverse()
  const result = validateSubmissionV2(body, rubric)
  assert.equal(result.ok, true)
  assert.equal(result.responses[0].questionId, 'I1')
  assert.deepEqual(result.sectionCoverage.interests, { answered: 5, informativeScenarios: 2 })
})

test('every question must be answered: a blank is reported against its question', () => {
  const body = submission()
  body.answers.find((answer) => answer.questionId === 'I1').optionId = null
  const result = validateSubmissionV2(body, rubric)
  assert.equal(result.status, 422)
  assert.deepEqual(result.issues, [{ questionId: 'I1', section: 'interests', code: 'QUESTION_UNANSWERED' }])
})

test('Unsure is no longer an option on any rating', () => {
  const body = submission()
  body.answers.find((answer) => answer.questionId === 'I1').optionId = '3'
  const result = validateSubmissionV2(body, rubric)
  assert.equal(result.status, 400)
  assert.ok(result.issues.some((issue) => issue.questionId === 'I1' && issue.code === 'INVALID_OPTION'))
})

test('scenarios no longer offer a "None of these" option E', () => {
  const body = submission()
  body.answers.find((answer) => answer.questionId === 'I2').optionId = 'e'
  const result = validateSubmissionV2(body, rubric)
  assert.equal(result.status, 400)
  assert.ok(result.issues.some((issue) => issue.questionId === 'I2' && issue.code === 'INVALID_OPTION'))
})

test('rejects stale versions, unknown IDs, duplicates, missing entries and invalid options', () => {
  const stale = submission()
  stale.rubricVersion = 'old'
  assert.equal(validateSubmissionV2(stale, rubric).status, 409)
  for (const mutate of [
    (b) => { b.answers[0].questionId = 'unknown' },
    (b) => { b.answers.push({ ...b.answers[0] }) },
    (b) => { b.answers.pop() },
    (b) => { b.answers[0].optionId = 5 },
    (b) => { delete b.answers[0].optionId },
    (b) => { b.submissionId = ' ' },
  ]) {
    const body = submission()
    mutate(body)
    assert.equal(validateSubmissionV2(body, rubric).status, 400)
  }
  for (const body of [null, [], {}, { rubricVersion: rubric.rubricVersion, answers: 'invalid' }]) {
    assert.equal(validateSubmissionV2(body, rubric).ok, false)
  }
})
