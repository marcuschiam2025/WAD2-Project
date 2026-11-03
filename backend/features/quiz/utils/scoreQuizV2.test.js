import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { scoreQuizV2, shuffleTieAcrossCutoff } from './scoreQuizV2.js'
import { calculateScenarioPreferences } from './scenarioPreferencesV2.js'
import { RATING_MAPPINGS, SCENARIO_MAPPINGS, SECTION_WEIGHTS, TRACK_PROFILES, SUPPORTING_THEME_WEIGHT } from '../content/rubric.v2.js'

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

test('with level ratings, each direction of scenario choices ranks its intended track first', () => {
  for (const [optionId, track] of [['a', 'BA'], ['b', 'PD'], ['c', 'FT'], ['d', 'SMT']]) {
    const result = scoreQuizV2(answers('4', optionId))
    assert.equal(result.rankingBasis, 'blended')
    assert.equal(result.results[0].track, track)
    assert.equal(result.results[0].rank, 1)
    assert.ok(result.results.every((r) => r.alignmentIndex >= 0 && r.alignmentIndex <= 100))
  }
})

test('ratings and scenarios both move the score: changing either can change the winner', () => {
  const ratedFor = (theme) => content.questions.map((q) => ({
    questionId: q.id,
    optionId: q.type === 'rating' ? (RATING_MAPPINGS[q.id].theme === theme ? '5' : '1') : 'a',
  }))
  // Ratings and scenarios agree on BA
  assert.equal(scoreQuizV2(ratedFor('DATA')).results[0].track, 'BA')
  // Same scenarios, ratings point to Fintech: the score moves towards Fintech and away from BA
  const data = Object.fromEntries(scoreQuizV2(ratedFor('DATA')).results.map((r) => [r.track, r.alignmentIndex]))
  const finance = Object.fromEntries(scoreQuizV2(ratedFor('FINANCE')).results.map((r) => [r.track, r.alignmentIndex]))
  assert.ok(finance.FT > data.FT)
  assert.ok(finance.BA < data.BA)
  // Same ratings, scenarios point to Fintech: same direction
  const fintechScenarios = ratedFor('DATA').map((a) => a.optionId === 'a' ? { ...a, optionId: 'c' } : a)
  const scenarioShift = Object.fromEntries(scoreQuizV2(fintechScenarios).results.map((r) => [r.track, r.alignmentIndex]))
  assert.ok(scenarioShift.FT > data.FT)
  assert.ok(scenarioShift.BA < data.BA)
})

test('rating generously or harshly does not change the score, only the pattern does', () => {
  const pattern = (high, low) => content.questions.map((q) => ({
    questionId: q.id,
    optionId: q.type === 'rating' ? (['DATA', 'BUILD'].includes(RATING_MAPPINGS[q.id].theme) ? high : low) : 'b',
  }))
  const scores = (rs) => scoreQuizV2(rs).results.map((r) => [r.track, r.alignmentIndex])
  assert.deepEqual(scores(pattern('5', '4')), scores(pattern('2', '1')))
})

test('tracks stay close to an even share on random answers, unlike a plain average of the two indices', () => {
  let seed = 12345
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
  const pick = (options) => options[Math.floor(random() * options.length)]
  const wins = { BA: 0, PD: 0, FT: 0, SMT: 0 }
  const runs = 20000
  for (let i = 0; i < runs; i++) {
    const rs = content.questions.map((q) => ({ questionId: q.id, optionId: pick(q.type === 'rating' ? ['1', '2', '4', '5'] : ['a', 'b', 'c', 'd']) }))
    wins[scoreQuizV2(rs).results[0].track] += 1
  }
  for (const share of Object.values(wins).map((count) => count / runs)) assert.ok(share > 0.18 && share < 0.32, JSON.stringify(wins))
})

test('a tie running across the top two is shuffled; a tie of two at the top is left alone', () => {
  const order = (values, random) => {
    const results = Object.entries(values).map(([track, alignmentIndex]) => ({ track, alignmentIndex }))
    shuffleTieAcrossCutoff(results, random)
    return results.map((r) => r.track)
  }
  const never = () => assert.fail('Two tied at the top both fit, so nothing is random')
  assert.deepEqual(order({ BA: 70, PD: 70, FT: 50, SMT: 40 }, never), ['BA', 'PD', 'FT', 'SMT'])
  assert.deepEqual(order({ BA: 80, PD: 70, FT: 50, SMT: 40 }, never), ['BA', 'PD', 'FT', 'SMT'])
  // Three tied at the top: each can reach the top two
  const top2 = new Set()
  for (const roll of [0, 0.4, 0.9]) for (const next of [0, 0.9]) {
    const rolls = [roll, next]
    top2.add(order({ BA: 70, PD: 70, FT: 70, SMT: 40 }, () => rolls.shift()).slice(0, 2).sort().join())
  }
  assert.deepEqual([...top2].sort(), ['BA,FT', 'BA,PD', 'FT,PD'])
  // A clear winner with a tie for second: the winner stays, and the last place stays out of the shuffle
  const results = order({ BA: 90, PD: 70, FT: 70, SMT: 40 }, () => 0)
  assert.deepEqual([results[0], results[3]], ['BA', 'SMT'])
  assert.deepEqual(results.slice(1, 3).sort(), ['FT', 'PD'])
  // All four tied
  assert.deepEqual(order({ BA: 50, PD: 50, FT: 50, SMT: 50 }, () => 0), ['PD', 'FT', 'SMT', 'BA'])
})

test('all-equal ratings no longer tie on the score: scenarios decide', () => {
  const result = scoreQuizV2(answers('5', 'c'))
  assert.equal(result.results[0].track, 'FT')
  assert.equal(result.results[0].rank, 1)
  assert.ok(result.results[1].rank > 1)
})

test('missing rating evidence is refused rather than guessed', () => {
  const rs = answers('5', 'a')
  for (const r of rs) if (['I1', 'S1'].includes(r.questionId)) r.optionId = null
  assert.throws(() => scoreQuizV2(rs), /Missing ratings for: DATA/)
})

test('scenario normalisation agrees with a hand-calculated BA example', () => {
  const result = calculateScenarioPreferences(answers('4', 'a')).find((r) => r.track === 'BA')
  // BA: I2 DATA/CIVIC = 47.5, I4 DATA/RELIABLE = 47.5;
  // S2/S4/W2 = 47.5; W4/C2/C4 DATA/PEOPLE = 48.75.
  // A is the maximum-support option on every question for BA.
  assert.equal(result.scenarioPreferenceIndex, 100)
  assert.ok(Object.values(result.sectionPreferenceIndices).every((value) => value === 100))
})

test('skipped scenarios are omitted; every track can reach its scenario ceiling', () => {
  const reduced = answers('4', 'a')
  for (const response of reduced) {
    if (['I4', 'S4', 'W4', 'C4'].includes(response.questionId)) response.optionId = null
  }
  assert.equal(calculateScenarioPreferences(reduced).find((r) => r.track === 'BA').scenarioPreferenceIndex, 100)
  for (const [track, profile] of Object.entries(TRACK_PROFILES)) {
    const best = answers('4', 'a')
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
  reduced.find((r) => r.questionId === 'I2').optionId = null
  assert.throws(() => calculateScenarioPreferences(reduced), /Missing informative scenario/)
})

test('overall scenario index uses the agreed section weights exactly', () => {
  const mixed = answers('4', 'a')
  mixed.find((r) => r.questionId === 'C4').optionId = 'c'
  for (const result of calculateScenarioPreferences(mixed)) {
    const expected = Object.entries(SECTION_WEIGHTS).reduce((sum, [section, weight]) => sum + result.sectionPreferenceIndices[section] * weight, 0) / 100
    assert.equal(result.scenarioPreferenceIndex, expected)
  }
})
