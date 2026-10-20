import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateSubmissionV2 } from './validateSubmissionV2.js'

const rubric = JSON.parse(await readFile(new URL('../content/questions.v2-draft.json', import.meta.url), 'utf8'))
const submission = () => ({
  rubricVersion: rubric.rubricVersion,
  submissionId: 'attempt-1',
  answers: rubric.questions.map((q) => ({ questionId: q.id, optionId: q.type === 'rating' ? '3' : 'a' })),
})

test('unsure ratings count as answered, and shuffled input is normalised by ID', () => {
  const body = submission()
  body.answers.reverse()
  const result = validateSubmissionV2(body, rubric)
  assert.equal(result.ok, true)
  assert.equal(result.responses[0].questionId, 'I1')
  assert.deepEqual(result.sectionCoverage.interests, { answered: 5, informativeScenarios: 2 })
})

test('three answers including one scenario meet the exact section minimum', () => {
  const body = submission()
  for (const answer of body.answers) {
    if (['4', '5'].includes(answer.questionId[1])) answer.optionId = null
  }
  assert.equal(validateSubmissionV2(body, rubric).ok, true)
  body.answers.find((answer) => answer.questionId === 'I1').optionId = null
  const result = validateSubmissionV2(body, rubric)
  assert.equal(result.status, 422)
  assert.ok(result.issues.some((issue) => issue.section === 'interests' && issue.code === 'SECTION_NEEDS_THREE_ANSWERS'))
})

test('all three ratings cannot replace the required scenario; E counts as unanswered', () => {
  const body = submission()
  for (const answer of body.answers) {
    if (['I2', 'I4'].includes(answer.questionId)) answer.optionId = 'e'
  }
  const result = validateSubmissionV2(body, rubric)
  assert.equal(result.status, 422)
  assert.deepEqual(result.issues, [{ section: 'interests', code: 'SECTION_NEEDS_SCENARIO' }])
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
