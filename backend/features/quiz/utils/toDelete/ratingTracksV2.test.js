import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { calculateRatingTracks } from '../ratingTracksV2.js'
import { THEMES, TRACK_PROFILES, RATING_MAPPINGS } from '../../content/rubric.v2.js'

const responses = (optionId) => Object.keys(RATING_MAPPINGS).map((questionId) => ({ questionId, optionId }))

test('rubric matches content and gives every theme two ratings and every track 100 weight', async () => {
  const content = JSON.parse(await readFile(new URL('../content/questions.v2-draft.json', import.meta.url), 'utf8'))
  const ratings = content.questions.filter((q) => q.type === 'rating')
  assert.deepEqual(ratings.map((q) => q.id).sort(), Object.keys(RATING_MAPPINGS).sort())
  for (const q of ratings) assert.equal(RATING_MAPPINGS[q.id].section, q.section)
  for (const theme of THEMES) {
    assert.equal(Object.values(RATING_MAPPINGS).filter((m) => m.theme === theme).length, 2)
  }
  for (const profile of Object.values(TRACK_PROFILES)) assert.equal(Object.values(profile).reduce((a, b) => a + b), 100)
})

test('complete high and low ratings reach shared endpoints for all tracks', () => {
  for (const [optionId, index] of [['5', 100], ['1', 0]]) {
    const result = calculateRatingTracks(responses(optionId))
    assert.deepEqual(result.missingThemes, [])
    assert.ok(Object.values(result.themeCoverage).every((count) => count === 2))
    assert.deepEqual(result.results.map((r) => [r.track, r.alignmentIndex, r.rank]), [
      ['BA', index, 1], ['PD', index, 1], ['FT', index, 1], ['SMT', index, 1],
    ])
  }
})

test('DATA-only high ratings match a hand-calculated profile, with shared ranks', () => {
  const answers = responses('1')
  for (const answer of answers) if (['I1', 'S1'].includes(answer.questionId)) answer.optionId = '5'
  assert.deepEqual(calculateRatingTracks(answers).results, [
    { track: 'BA', alignmentIndex: 45, rank: 1 },
    { track: 'FT', alignmentIndex: 15, rank: 2 },
    { track: 'SMT', alignmentIndex: 15, rank: 2 },
    { track: 'PD', alignmentIndex: 10, rank: 4 },
  ])
})

test('missing theme withholds all track indices; one informative rating restores coverage', () => {
  const answers = responses('5')
  answers.find((r) => r.questionId === 'I1').optionId = '3'
  answers.find((r) => r.questionId === 'S1').optionId = null
  const missing = calculateRatingTracks(answers)
  assert.deepEqual(missing.missingThemes, ['DATA'])
  assert.equal(missing.themeCoverage.DATA, 0)
  assert.ok(missing.results.every((r) => r.alignmentIndex === null && r.rank === undefined))
  answers.find((r) => r.questionId === 'S1').optionId = '4'
  const restored = calculateRatingTracks(answers)
  assert.deepEqual(restored.missingThemes, [])
  assert.deepEqual(restored.themeRatings.DATA, { index: 75, informativeCount: 1 })
})
