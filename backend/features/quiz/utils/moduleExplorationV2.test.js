import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { recommendExplorationModules } from './moduleExplorationV2.js'
import { createModuleExplorationV2 } from '../quiz.v2.recommendations.js'

const catalogue = JSON.parse(await readFile(new URL('../content/modules.ay2025.json', import.meta.url), 'utf8'))
const attempt = {
  results: [{ track: 'BA' }, { track: 'SMT' }, { track: 'FT' }, { track: 'PD' }],
  resultSnapshot: { themeRatings: { DATA: { index: 100 }, PEOPLE: { index: 80 }, CIVIC: { index: null } } },
}

test('catalogue has official provenance, all four tracks and explicitly unknown eligibility', () => {
  assert.equal(catalogue.modules.length, 12)
  assert.equal(new Set(catalogue.modules.map((m) => m.code)).size, 12)
  for (const module of catalogue.modules) {
    assert.ok(module.sourceUrl.startsWith('https://computing.smu.edu.sg/bsc-information-systems/curriculum#'))
    assert.equal(module.prerequisites, null)
    assert.equal(module.termsOffered, null)
  }
  for (const track of ['BA', 'PD', 'FT', 'SMT']) assert.ok(catalogue.modules.filter((m) => m.tracks.includes(track)).length >= 3)
  assert.equal(catalogue.modules.find((m) => m.code === 'IS442').name, 'Object Oriented Programming')
  assert.deepEqual(catalogue.modules.find((m) => m.code === 'SMT481').tracks, ['BA', 'SMT'])
})

test('suggests at most three verified courses for only the leading two tracks', () => {
  const result = recommendExplorationModules(attempt, catalogue, { intakeYear: 2025, completedModules: [' is217 '] })
  assert.deepEqual(result.groups.map((g) => g.track), ['BA', 'SMT'])
  assert.equal(result.intakeStatus, 'within-guide')
  for (const group of result.groups) {
    assert.ok(group.modules.length <= 3)
    assert.ok(group.modules.every((m) => m.tracks.includes(group.track) && m.code !== 'IS217'))
    assert.ok(group.modules.every((m) => m.prerequisiteStatus === 'unverified' && m.offeringStatus === 'unverified'))
  }
})

test('unknown ratings do not produce fabricated personal explanations', () => {
  const unknown = { ...attempt, resultSnapshot: { themeRatings: {} } }
  const result = recommendExplorationModules(unknown, catalogue)
  assert.equal(result.intakeStatus, 'unconfirmed')
  assert.ok(result.groups.flatMap((g) => g.modules).every((m) => m.reason.startsWith('Listed in SMU')))
  assert.deepEqual(recommendExplorationModules(attempt, catalogue, { intakeYear: 2024 }).groups, [])
})

test('exhausted shortlist returns no modules rather than repeating completed courses', () => {
  const result = recommendExplorationModules(attempt, catalogue, { completedModules: catalogue.modules.map((m) => m.code) })
  assert.ok(result.groups.every((g) => g.modules.length === 0))
})

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this }, set() { return this }, json(body) { this.body = body; return this } })

test('recommendation endpoint scopes lookup to the signed-in user and rejects legacy/missing results', async () => {
  const id = '507f1f77bcf86cd799439011'
  let filter
  const handler = createModuleExplorationV2(async (query) => { filter = query; return attempt }, async () => catalogue)
  const res = response()
  await handler({ params: { id }, user: { _id: 'current-user', intakeYear: 2025 } }, res)
  assert.deepEqual(filter, { _id: id, user: 'current-user' })
  assert.equal(res.body.groups.length, 2)
  for (const [found, status] of [[null, 404], [{ results: [] }, 409]]) {
    const res = response()
    await createModuleExplorationV2(async () => found)({ params: { id }, user: { _id: 'current-user' } }, res)
    assert.equal(res.statusCode, status)
  }
  const invalid = response()
  await handler({ params: { id: 'invalid' }, user: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
})
