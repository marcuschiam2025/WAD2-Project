import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkPlan } from './requirementChecker.js'

const mod = (code, extra = {}) => ({ _id: code, title: code, cu: 1, categories: [], fulfils: [], ...extra })
const catalogue = Object.fromEntries(
  [
    mod('IS111'),
    mod('IS113', { categories: ['IS'], prerequisites: [['IS111', 'CS101']] }),
    mod('IS216', { categories: ['IS'] }),
    mod('IS442', { categories: ['IS', 'IS_TRACK'], corequisites: [['IS216']], mutuallyExclusive: ['CS102'] }),
    mod('CS102'),
    mod('IS217', { categories: ['IS', 'IS_TRACK'], fulfils: ['GRAD:DIGITAL_TECH'] }),
    mod('IS460', { categories: ['IS', 'IS_TRACK'] }),
    mod('IS415', { categories: ['IS', 'IS_TRACK'] }),
    mod('IS483', { categories: ['IS'], prerequisiteRules: [{ countFrom: 'TRACK', n: 2 }] }),
    mod('COR-MGMT1302', { fulfils: ['CORE:MANAGING'] }),
    mod('COR-COMM1304', { fulfils: ['CORE:MANAGING'] }),
    mod('ART101'),
    mod('ART102'),
  ].map((m) => [m._id, m]),
)

const req = (id, extra) => ({ _id: id, level: 'major', label: id, order: 1, ...extra })
const requirements = [
  req('CORE_MANAGING', { level: 'core', rule: 'basket', tag: 'CORE:MANAGING', cuRequired: 1 }),
  req('CORE_FLAG', { level: 'core', order: 2, rule: 'flag', tag: 'GRAD:DIGITAL_TECH', cuRequired: 0 }),
  req('SW_DEV', { rule: 'all', modules: ['IS111', 'IS113', 'IS216'], cuRequired: 3 }),
  req('IS_ELECTIVES', { order: 2, rule: 'anyFromCategory', categories: ['IS_TRACK', 'IS'], cuRequired: 1 }),
  req('FREE', { order: 3, rule: 'anyFromCategory', categories: ['ANY'], cuRequired: 2 }),
]
const ba = {
  trackCode: 'BA',
  requirements: [
    req('BA_COMPULSORY', { level: 'track', rule: 'all', modules: ['IS217'], cuRequired: 1 }),
    req('BA_ELECTIVES', { level: 'track', order: 2, rule: 'chooseN', n: 1, modules: ['IS460', 'IS415'], cuRequired: 1 }),
  ],
}
const smct = {
  trackCode: 'SMCT',
  requirements: [req('SMCT_ELECTIVES', { level: 'track', rule: 'chooseN', n: 2, modules: ['IS217', 'IS415'], cuRequired: 2 })],
}
const major = { _id: 'BSC-IS_AY2025', totalCU: 9 }

const plan = (semesters, currentSem = 'Y1S1') => ({
  currentSem,
  semesters: semesters.map((modules, i) => ({ id: `Y1S${i + 1}`, loa: false, modules })),
})
const check = (p, tracks = [ba]) => checkPlan(p, { major, requirements, tracks, catalogue })
const find = (result, id) => result.requirements.find((r) => r.id === id)

test('specific requirements are filled before broad ones', () => {
  // IS460 could be an IS elective or a free elective, but the BA list claims it first
  const result = check(plan([['IS460', 'IS415', 'ART101']]))
  assert.deepEqual(find(result, 'BA_ELECTIVES').modules.map((m) => m.code), ['IS460'])
  assert.deepEqual(find(result, 'IS_ELECTIVES').modules.map((m) => m.code), ['IS415'])
  assert.deepEqual(find(result, 'FREE').modules.map((m) => m.code), ['ART101'])
})

test('done vs planned follows the current semester', () => {
  const result = check(plan([['IS111'], ['IS113'], ['IS216']], 'Y1S2'))
  const sw = find(result, 'SW_DEV')
  assert.equal(sw.cuDone, 1)
  assert.equal(sw.cuPlanned, 3)
  assert.equal(sw.status, 'planned')
  assert.deepEqual(sw.modules.map((m) => m.status), ['done', 'planned', 'planned'])
})

test('outstanding lists what is left to take', () => {
  const result = check(plan([['IS111', 'COR-MGMT1302']]))
  assert.deepEqual(find(result, 'SW_DEV').outstanding, {
    cu: 2,
    mustTake: [
      { code: 'IS113', title: 'IS113' },
      { code: 'IS216', title: 'IS216' },
    ],
  })
  assert.equal(find(result, 'CORE_MANAGING').outstanding, null)
  assert.deepEqual(find(result, 'BA_ELECTIVES').outstanding.chooseFrom.map((m) => m.code), ['IS460', 'IS415'])
  assert.deepEqual(find(result, 'FREE').outstanding, { cu: 2, anyCourse: true })
  assert.deepEqual(
    result.outstanding.map((o) => o.requirement),
    ['CORE_FLAG', 'SW_DEV', 'IS_ELECTIVES', 'FREE', 'BA_COMPULSORY', 'BA_ELECTIVES'],
  )
})

test('basket options exclude courses already placed', () => {
  const result = check(plan([[]]))
  assert.deepEqual(
    find(result, 'CORE_MANAGING').outstanding.chooseFrom.map((m) => m.code),
    ['COR-MGMT1302', 'COR-COMM1304'],
  )
})

test('flags are met by any placed course with the tag, without using it up', () => {
  const result = check(plan([['IS217']]))
  assert.equal(find(result, 'CORE_FLAG').status, 'planned')
  assert.deepEqual(find(result, 'BA_COMPULSORY').modules.map((m) => m.code), ['IS217'])
})

test('a second track is checked without using courses up, and totals stay at the major total', () => {
  const result = check(plan([['IS217', 'IS415']]), [ba, smct])
  assert.deepEqual(find(result, 'BA_COMPULSORY').modules.map((m) => m.code), ['IS217'])
  assert.deepEqual(find(result, 'BA_ELECTIVES').modules.map((m) => m.code), ['IS415'])
  assert.equal(result.extraTracks[0].trackCode, 'SMCT')
  assert.equal(result.extraTracks[0].requirements[0].status, 'planned')
  assert.equal(result.requiredCu, 9)
  assert.equal(result.plannedCu, 2)
})

test('warnings: prereq groups, coreqs, exclusions and course-count rules', () => {
  const result = check(plan([['IS113', 'IS442', 'CS102', 'IS483']]))
  assert.deepEqual(result.warnings, [
    { module: 'IS113', semester: 'Y1S1', prereqs: [['IS111', 'CS101']], coreqs: [], exclusions: [], rules: [] },
    { module: 'IS442', semester: 'Y1S1', prereqs: [], coreqs: [['IS216']], exclusions: ['CS102'], rules: [] },
    { module: 'IS483', semester: 'Y1S1', prereqs: [], coreqs: [], exclusions: [], rules: ['2 track courses before this one'] },
  ])
  assert.equal(check(plan([['IS111'], ['IS113']])).onTrack, true)
})

test('exchange mappings count as the SMU course; unknown codes are reported', () => {
  const result = check(plan([['CS412 → IS460', 'XYZ999']]))
  assert.deepEqual(find(result, 'BA_ELECTIVES').modules.map((m) => m.code), ['IS460'])
  assert.deepEqual(result.unknownModules, ['XYZ999'])
})

test('courses beyond every requirement are unallocated', () => {
  const result = check(plan([['ART101', 'ART102', 'IS111', 'COR-COMM1304', 'COR-MGMT1302']]))
  assert.deepEqual(find(result, 'FREE').modules.map((m) => m.code), ['ART101', 'ART102'])
  assert.deepEqual(result.unallocated, ['COR-MGMT1302'])
})

test('an internship in an LOA term counts towards the internship requirement', () => {
  const internship = mod('INTERNSHIP', { fulfils: ['CORE:INTERNSHIP'] })
  const internshipReq = req('CORE_INTERNSHIP', { level: 'core', rule: 'basket', tag: 'CORE:INTERNSHIP', cuRequired: 1 })
  const loaPlan = {
    currentSem: 'Y1S1',
    semesters: [
      { id: 'Y1S1', loa: false, modules: ['IS111'] },
      { id: 'Y1S2', loa: true, modules: ['INTERNSHIP'] },
    ],
  }
  const result = checkPlan(loaPlan, {
    major,
    requirements: [internshipReq],
    catalogue: { ...catalogue, INTERNSHIP: internship },
  })
  const internshipResult = result.requirements[0]
  assert.equal(internshipResult.status, 'planned')
  assert.deepEqual(internshipResult.modules, [{ code: 'INTERNSHIP', title: 'INTERNSHIP', status: 'planned', semester: 'Y1S2' }])
  assert.equal(result.requiredCu, 1)
})
