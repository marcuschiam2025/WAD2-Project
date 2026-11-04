import test from 'node:test'
import assert from 'node:assert/strict'
import { createSharedCatalogueLoader } from './sharedCatalogueV2.js'
import { recommendExplorationModules } from './moduleExplorationV2.js'

const attempt = { results: [{ track: 'SMT' }, { track: 'BA' }], resultSnapshot: { themeRatings: {} } }
test('loads only top-two AY2025 tracks, maps SMT and uses shared module titles and prerequisites', async () => {
  const calls = []
  const load = createSharedCatalogueLoader({
    tracks: async (filter) => { calls.push(filter); return [{ _id: 'smart', trackCode: 'SMCT' }, { _id: 'data', trackCode: 'BA' }] },
    requirements: async () => [{ ownerId: 'smart', modules: ['NEW101', 'LOCKED', 'DONE', 'EXCLUDED', 'ARCHIVED'] }, { ownerId: 'data', modules: ['NEW101', 'ADVANCED'] }],
    modules: async () => [
      { _id: 'NEW101', title: 'Shared title', description: 'Shared description', prerequisites: [['BASE', 'OTHER']] },
      { _id: 'LOCKED', title: 'Locked', prerequisites: [['MISSING']] },
      { _id: 'DONE', title: 'Done' },
      { _id: 'ARCHIVED', title: 'Archived', archived: true },
      { _id: 'EXCLUDED', title: 'Excluded', mutuallyExclusive: ['BASE'] },
      { _id: 'ADVANCED', title: 'Advanced', requisiteNotes: ['Instructor permission'] },
    ],
  })
  const catalogue = await load(attempt, { completedModules: [' base ', 'DONE'] })
  assert.deepEqual(calls, [{ majorId: 'BSC-IS_AY2025', trackCode: { $in: ['SMCT', 'BA'] } }])
  assert.deepEqual(catalogue.modules.map((m) => m.code), ['NEW101', 'ADVANCED'])
  assert.deepEqual(catalogue.modules[0].tracks, ['SMT', 'BA'])
  assert.equal(catalogue.modules[0].name, 'Shared title')
  const result = recommendExplorationModules(attempt, catalogue, { intakeYear: 2025 })
  assert.equal(result.catalogueSource, 'mongodb')
  assert.equal(result.groups[0].modules[0].prerequisiteStatus, 'recorded-prerequisites-met')
  assert.equal(result.groups[1].modules[1].prerequisiteStatus, 'manual-review')
})

test('empty shared database is reported without falling back to the curated shortlist', async () => {
  const load = createSharedCatalogueLoader({ tracks: async () => [], requirements: async () => [], modules: async () => [] })
  const result = recommendExplorationModules(attempt, await load(attempt, {}))
  assert.deepEqual(result.groups.map((g) => g.modules), [[], []])
  assert.equal(result.catalogueSource, 'mongodb')
  assert.equal(result.catalogueStatus, 'unavailable')
})

test('the 2024 intake gets suggestions and the 2023 intake is unsupported', async () => {
  let trackLookups = 0
  const load = createSharedCatalogueLoader({
    tracks: async () => { trackLookups++; return [{ _id: 'smart', trackCode: 'SMCT' }, { _id: 'data', trackCode: 'BA' }] },
    requirements: async () => [{ ownerId: 'smart', modules: ['NEW101'] }],
    modules: async () => [{ _id: 'NEW101', title: 'Shared title' }],
  })

  const intake2024 = recommendExplorationModules(attempt, await load(attempt, { intakeYear: 2024 }), { intakeYear: 2024 })
  assert.equal(intake2024.intakeStatus, 'within-guide')
  assert.equal(trackLookups, 1)
  assert.deepEqual(intake2024.groups[0].modules.map((m) => m.code), ['NEW101'])

  const intake2023 = recommendExplorationModules(attempt, await load(attempt, { intakeYear: 2023 }), { intakeYear: 2023 })
  assert.equal(intake2023.intakeStatus, 'unsupported')
  assert.equal(trackLookups, 1, 'an unsupported intake never reaches the track lookup')
  assert.deepEqual(intake2023.groups, [])
})

test('repository catalogue supports all four tracks and excludes completed courses', async () => {
  const { readFile } = await import('node:fs/promises')
  const data = async (name) => JSON.parse(await readFile(new URL(`../../../data/${name}.json`, import.meta.url), 'utf8'))
  const [trackData, rules, moduleData] = await Promise.all(['tracks', 'requirements', 'modules'].map(data))
  const load = createSharedCatalogueLoader({
    tracks: async (f) => trackData.filter((t) => t.majorId === f.majorId && f.trackCode.$in.includes(t.trackCode)),
    requirements: async (f) => rules.filter((r) => f.ownerId.$in.includes(r.ownerId) && r.level === f.level).sort((a,b) => a.order - b.order),
    modules: async (f) => moduleData.filter((m) => f._id.$in.includes(m._id)),
  })
  for (const pair of [['BA','SMT'], ['PD','FT']]) {
    const sample = { ...attempt, results: pair.map((track) => ({ track })) }
    const catalogue = await load(sample, {})
    assert.equal(catalogue.catalogueStatus, 'available')
    for (const code of pair) assert.ok(catalogue.modules.some((m) => m.tracks.includes(code)), code)
    const done = catalogue.modules.map((m) => m.code)
    assert.ok((await load(sample, { completedModules: done })).modules.every((m) => !done.includes(m.code)))
  }
})
