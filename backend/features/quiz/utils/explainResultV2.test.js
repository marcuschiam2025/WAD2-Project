import test from 'node:test'
import assert from 'node:assert/strict'
import { buildExplanationPrompt, leadingResults } from './explainResultV2.js'

const result = (track, rank, alignmentIndex, ratingAlignmentIndex = alignmentIndex, scenarioPreferenceIndex = alignmentIndex) =>
  ({ track, rank, alignmentIndex, ratingAlignmentIndex, scenarioPreferenceIndex })
const attempt = (results, extra = {}) => ({
  results,
  rubricSnapshot: { questions: [{ prompt: 'SECRET RUBRIC' }] },
  resultSnapshot: {
    rankingBasis: 'blended',
    results,
    themeRatings: { DATA: { index: 90.4 }, CIVIC: { index: 20 }, PEOPLE: { index: null } },
    answerLabels: [{ questionId: 'I1', prompt: 'How much do you enjoy data?', label: 'A lot' }, { questionId: 'I2', prompt: 'Pick a project', label: null }],
    ...extra,
  },
})
const promptData = (prompt) => JSON.parse(prompt.slice(prompt.indexOf('{')))

test('two leading tracks: asks for exactly two entries, by name and code', () => {
  const { system, prompt, schema } = buildExplanationPrompt(attempt([result('BA', 1, 80.6), result('PD', 2, 60, 50, 70), result('FT', 3, 40)]))
  assert.match(prompt, /Business Analytics \(track code BA\) and Product Development \(track code PD\).*exactly two entries/)
  const data = promptData(prompt)
  assert.deepEqual(data.leadingTracks.map((t) => [t.track, t.fit, t.basedOn]), [
    ['BA', 'strong fit', 'both the self-ratings and the scenario choices'],
    ['PD', 'good fit', 'mostly the scenario choices'],
  ])
  assert.deepEqual(data.leadingTracks[0].valuesMost, ['working with data and evidence', 'working with people and stakeholders'])
  assert.equal(data.howTheLeadersCompare, 'the first leads clearly')
  assert.deepEqual(data.otherTracks, [{ name: 'Financial Technology', fit: 'weak fit' }])
  assert.deepEqual(schema.required, ['summary', 'tracks'])
  assert.match(system, /not a prediction/)
  assert.match(system, /Never mention numbers/)
})

test('one leading track: asks for exactly one entry', () => {
  const { prompt } = buildExplanationPrompt(attempt([result('SMT', 1, 75)]))
  assert.match(prompt, /Smart-City Management & Technology \(track code SMT\).*exactly one entry/)
  assert.doesNotMatch(prompt, /exactly two/)
  const data = promptData(prompt)
  assert.equal(data.leadingTracks.length, 1)
  assert.equal(data.howTheLeadersCompare, 'one clear leading track')
  assert.deepEqual(data.otherTracks, [])
})

test('sends levels in words and no raw scores, so there is nothing to quote', () => {
  const { prompt } = buildExplanationPrompt(attempt([result('BA', 1, 80.6, 77.3), result('PD', 2, 61.2), result('FT', 3, 44.4)]))
  const data = promptData(prompt)
  assert.deepEqual(data.studentInterestLevels['working with data and evidence'], 'high')
  assert.deepEqual(data.studentInterestLevels['cities, public services and civic impact'], 'low')
  assert.deepEqual(data.studentInterestLevels['working with people and stakeholders'], 'not enough answers')
  assert.doesNotMatch(JSON.stringify(data), /\d/)
})

test('keeps answered choices and leaves out skipped ones', () => {
  const data = promptData(buildExplanationPrompt(attempt([result('BA', 1, 80)])).prompt)
  assert.deepEqual(data.studentChoices, ['How much do you enjoy data? → A lot'])
})

test('flags tied, close and provisional results for the model', () => {
  assert.equal(promptData(buildExplanationPrompt(attempt([result('BA', 1, 70), result('FT', 1, 70)])).prompt).howTheLeadersCompare, 'tied')
  assert.equal(promptData(buildExplanationPrompt(attempt([result('BA', 1, 70), result('FT', 2, 66)])).prompt).howTheLeadersCompare, 'very close')
  const provisional = promptData(buildExplanationPrompt(attempt([result('PD', 1, 60)], { rankingBasis: 'scenario-provisional' })).prompt)
  assert.equal(provisional.provisional, true)
})

test('never sends the rubric snapshot', () => {
  const { system, prompt } = buildExplanationPrompt(attempt([result('BA', 1, 80)]))
  assert.doesNotMatch(system + prompt, /SECRET RUBRIC|rubricSnapshot/)
})

test('leadingResults returns one or two tracks in rank order', () => {
  assert.deepEqual(leadingResults(attempt([result('BA', 1, 80)])).map((r) => r.track), ['BA'])
  assert.deepEqual(leadingResults(attempt([result('BA', 1, 80), result('PD', 2, 70), result('FT', 3, 60)])).map((r) => r.track), ['BA', 'PD'])
})
