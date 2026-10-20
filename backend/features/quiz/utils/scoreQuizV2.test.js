import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { scoreQuizV2 } from './scoreQuizV2.js'
import { calculateScenarioPreferences } from './scenarioPreferencesV2.js'
import { SCENARIO_MAPPINGS, SECTION_WEIGHTS, TRACK_PROFILES, SUPPORTING_THEME_WEIGHT } from '../content/rubric.v2.js'

const content = JSON.parse(await readFile(new URL('../content/questions.v2-draft.json', import.meta.url), 'utf8'))
const answers = (rating, scenario) => content.questions.map((q) => ({ questionId: q.id, optionId: q.type === 'rating' ? rating : scenario }))

test('all scenario mappings match the content and known profile themes', () => {
  const questions = content.questions.filter((q) => q.type === 'scenario')
  assert.deepEqual(questions.map((q) => q.id).sort(), Object.keys(SCENARIO_MAPPINGS).sort())
  for (const q of questions) {
    const mapping = SCENARIO_MAPPINGS[q.id]
    assert.equal(mapping.section, q.section)
    assert.deepEqual(Object.keys(mapping.options).sort(), ['a', 'b', 'c', 'd'])
    for (const themes of Object.values(mapping.options)) {
      for (const profile of Object.values(TRACK_PROFILES)) assert.ok(themes.every((theme) => Number.isFinite(profile[theme])))
    }
  }
})

test('provisional domain examples rank their intended track without inventing rating indices', () => {
  for (const [optionId, track] of [['a', 'BA'], ['b', 'PD'], ['c', 'FT'], ['d', 'SMT']]) {
    const result = scoreQuizV2(answers('3', optionId))
    assert.equal(result.rankingBasis, 'scenario-provisional')
    assert.equal(result.results[0].track, track)
    assert.equal(result.results[0].rank, 1)
    assert.ok(result.results.every((r) => r.alignmentIndex === null && r.scenarioPreferenceIndex >= 0 && r.scenarioPreferenceIndex <= 100))
  }
})

test('complete rating ties remain ties even when scenarios strongly favour FT', () => {
  const result = scoreQuizV2(answers('5', 'c'))
  assert.equal(result.rankingBasis, 'rating')
  assert.deepEqual(result.results.map((r) => [r.track, r.rank, r.alignmentIndex]), [
    ['BA', 1, 100], ['PD', 1, 100], ['FT', 1, 100], ['SMT', 1, 100],
  ])
  assert.ok(result.results.find((r) => r.track === 'FT').scenarioPreferenceIndex > result.results[0].scenarioPreferenceIndex)
})

test('scenario normalisation agrees with a hand-calculated BA example', () => {
  const result = calculateScenarioPreferences(answers('3', 'a')).find((r) => r.track === 'BA')
  // BA: I2 DATA/CIVIC = 47.5, I4 DATA/RELIABLE = 47.5;
  // S2/S4/W2 = 47.5; W4/C2/C4 DATA/PEOPLE = 48.75.
  // A is the maximum-support option on every question for BA.
  assert.equal(result.scenarioPreferenceIndex, 100)
  assert.ok(Object.values(result.sectionPreferenceIndices).every((value) => value === 100))
})

test('skipped/E scenarios are omitted; every track can reach its scenario ceiling', () => {
  const reduced = answers('3', 'a')
  for (const response of reduced) {
    if (['I4', 'S4'].includes(response.questionId)) response.optionId = 'e'
    if (['W4', 'C4'].includes(response.questionId)) response.optionId = null
  }
  assert.equal(calculateScenarioPreferences(reduced).find((r) => r.track === 'BA').scenarioPreferenceIndex, 100)
  for (const [track, profile] of Object.entries(TRACK_PROFILES)) {
    const best = answers('3', 'a')
    for (const response of best) {
      const mapping = SCENARIO_MAPPINGS[response.questionId]
      if (!mapping) continue
      response.optionId = Object.entries(mapping.options).sort((a, b) => {
        const value = ([primary, secondary]) => profile[primary] + SUPPORTING_THEME_WEIGHT * profile[secondary]
        return value(b[1]) - value(a[1])
      })[0][0]
    }
    assert.equal(calculateScenarioPreferences(best).find((r) => r.track === track).scenarioPreferenceIndex, 100)
  }
  reduced.find((r) => r.questionId === 'I2').optionId = 'e'
  assert.throws(() => calculateScenarioPreferences(reduced), /Missing informative scenario/)
})

test('overall scenario index uses the agreed section weights exactly', () => {
  const mixed = answers('3', 'a')
  mixed.find((r) => r.questionId === 'C4').optionId = 'c'
  for (const result of calculateScenarioPreferences(mixed)) {
    const expected = Object.entries(SECTION_WEIGHTS).reduce((sum, [section, weight]) => sum + result.sectionPreferenceIndices[section] * weight, 0) / 100
    assert.equal(result.scenarioPreferenceIndex, expected)
  }
})
