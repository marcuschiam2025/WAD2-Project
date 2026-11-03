import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

// The layout lists the live curriculum under the course-progression headings, with recommended semesters,
// without changing what the curriculum builder counts.
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
const { buildCurriculumChecklist } = await server.ssrLoadModule('/src/core/utils/curriculumChecklist.js')
const { layoutCurriculum } = await server.ssrLoadModule('/src/core/utils/curriculumLayout.js')
test.after(() => server.close())

const mod = (code, fulfils = [], categories = []) => [code, { code, name: code, cu: 1, fulfils, categories }]
const catalogue = Object.fromEntries([
  mod('IS114', [], ['IS']), mod('IS210', [], ['IS']), mod('IS217', [], ['IS_TRACK']), mod('IS424', [], ['IS_TRACK']),
  mod('IS428', [], ['IS_TRACK']), mod('COR1100', ['CORE:WRITING_REASONING']), mod('MGT1', ['CORE:MANAGING']), mod('FREE1'),
])
const sem = (id, modules) => ({ id, label: id, exchange: false, loa: false, modules })
const plan = {
  majorId: 'BSC-IS_AY2025', tracks: ['BA'], currentSem: 'Y2S1',
  semesters: [sem('Y1S1', ['IS114', 'COR1100']), sem('Y1S2', []), sem('Y2S1', ['IS210']), sem('Y2S2', ['IS424']), sem('Y3S1', [])],
}
const req = (id, level, extra) => ({ _id: id, level, cuRequired: 1, ...extra })
const bundle = {
  majorId: 'BSC-IS_AY2025',
  requirements: [
    req('WRITING', 'core', { heading: 'Capabilities', label: 'Writing', rule: 'basket', tag: 'CORE:WRITING_REASONING', countsToward: 'UNI_CORE' }),
    req('MANAGING', 'core', { heading: 'Capabilities', label: 'Managing', rule: 'basket', tag: 'CORE:MANAGING', countsToward: 'UNI_CORE' }),
    req('TECH', 'major', { heading: 'Technology Solutioning', label: 'Technology Solutioning', rule: 'all', modules: ['IS114', 'IS210'], cuRequired: 2, countsToward: 'MAJOR_CORE' }),
    req('IS_ELECT', 'major', { heading: 'IS Major Electives', label: 'Any IS course', rule: 'anyFromCategory', categories: ['IS'], countsToward: 'MAJOR_ELECTIVES' }),
    req('FREE', 'major', { heading: 'Free Electives', label: 'Any SMU course', rule: 'anyFromCategory', categories: ['ANY'], cuRequired: 2, countsToward: 'FREE_ELECTIVES' }),
    req('SUST', 'core', { heading: 'Additional Graduation Requirements', label: 'Sustainability', rule: 'flag', tag: 'GRAD:SUSTAINABILITY', cuRequired: 0 }),
  ],
  tracks: [
    { _id: 'BSC-IS_AY2025_BA', trackCode: 'BA', name: 'Business Analytics', requirements: [req('BA_PICK', 'track', { ownerId: 'BSC-IS_AY2025_BA', label: 'Any 3 Track Courses', rule: 'chooseN', n: 3, modules: ['IS217', 'IS424', 'IS428'], cuRequired: 3, countsToward: 'MAJOR_ELECTIVES' })] },
  ],
}
const built = buildCurriculumChecklist(plan, catalogue, bundle)
const laid = layoutCurriculum(built, plan, bundle, { majorCode: 'BSC-IS' })
const rows = laid.groups.flatMap((g) => g.slots)
const row = (id) => rows.find((r) => r.id === id)

test('rows are listed under the spreadsheet headings, never "Major · <requirement>"', () => {
  assert.deepEqual(laid.groups.map((g) => g.label), [
    'University Core · Capabilities', 'IS Major Core', 'IS Major Electives', 'Free Electives',
  ])
  assert.ok(laid.groups.every((g) => !/^Major · /.test(g.label)))
})

test('track requirements are named after their track and listed first under the electives', () => {
  const electives = laid.groups.find((g) => g.key === 'major-elective').slots
  assert.deepEqual(electives.map((r) => r.id), ['BA_PICK', 'IS_ELECT'])
  assert.equal(row('BA_PICK').label, 'Business Analytics · Any 3 Track Courses')
  assert.equal(row('BA_PICK').trackCode, 'BA')
})

test('each row carries the recommended semesters from the course progression, for the hover tag', () => {
  // Technology Solutioning lists IS114 (Y1S1) and IS210 (Y2S1): the window spans both
  assert.equal(row('TECH').rec.label, 'Y1S1–Y2S1')
  assert.deepEqual(row('TECH').rec.ids, ['Y1S1', 'Y1S2', 'Y2S1'])
  // a tagged basket row uses its basket's window
  assert.equal(row('MANAGING').rec.label, 'Y1S1–Y4S1')
  // electives use the progression's elective and free elective windows
  assert.equal(row('IS_ELECT').rec.label, 'Y3S1–Y4S2')
  assert.equal(row('FREE').rec.label, 'Y2S2–Y4S2')
  assert.ok(laid.other.every((r) => r.rec && r.chip))
})

test('a todo row shows its recommended semester; a row already planned shows where it sits', () => {
  assert.equal(row('MANAGING').status, 'todo')
  assert.equal(row('MANAGING').chip.text, 'Y2S1', 'recommended window Y1S1–Y4S1 already open: current semester')
  assert.equal(row('BA_PICK').status, 'todo')
  assert.equal(row('TECH').status, 'inProgress')
  assert.equal(row('TECH').chip.tone, 'inProgress')
})

test('the layout never changes row statuses, details or the labels of non-track rows', () => {
  const before = Object.fromEntries(built.groups.flatMap((g) => g.slots).map((r) => [r.id, [r.status, r.detail]]))
  for (const r of rows) {
    assert.deepEqual([r.status, r.detail], before[r.id], r.id)
    if (!r.trackCode) assert.equal(r.label, built.groups.flatMap((g) => g.slots).find((x) => x.id === r.id).label)
  }
})

test('totals are counted in courses: a requirement only part met still counts the courses it has', () => {
  // Technology Solutioning needs 2: IS114 is cleared (Y1S1) and IS210 is in progress (Y2S1), yet the row is not "done"
  assert.equal(row('TECH').status, 'inProgress')
  const credit = (id) => { const { held, ...counts } = row(id).credit; return { counts, held: held.map((h) => h.code) } }
  assert.deepEqual(credit('TECH'), { counts: { required: 2, cleared: 1, exempted: 0, inProgress: 1, planned: 0, todo: 0 }, held: ['IS114', 'IS210'] })
  // "Any 3 Track Courses": IS424 is planned (Y2S2), two still to pick
  assert.equal(row('BA_PICK').status, 'todo')
  assert.deepEqual(credit('BA_PICK'), { counts: { required: 3, cleared: 0, exempted: 0, inProgress: 0, planned: 1, todo: 2 }, held: ['IS424'] })
  // The totals add the rows up: 10 courses asked for, 2 cleared, 1 in progress, 1 planned, 6 still to take
  assert.deepEqual(
    [laid.totals.required, laid.totals.cleared, laid.totals.inProgress, laid.totals.planned, laid.totals.todo],
    [10, 2, 1, 1, 6],
  )
  // ...which the requirement-by-requirement count could not show: it would have said 0 cleared / 1 in progress / 1 planned
  assert.equal(built.totals.cleared, 1)
})

test('exemptions and free elective exemptions count as exempted credit, not cleared', () => {
  const exempt = layoutCurriculum(
    buildCurriculumChecklist(plan, catalogue, bundle, { exempted: ['MGT1'], freeExempt: 1 }), plan, bundle, { majorCode: 'BSC-IS' })
  assert.equal(exempt.totals.exempted, 2, 'one exempted module (Managing) and one free elective')
  assert.equal(exempt.totals.cleared, 2)
  assert.equal(exempt.totals.required, 10)
})

test('"behind the recommended term" counts the courses still to take whose window has already passed', () => {
  // Writing is recommended for Y1S1–Y1S2; this student is in Y2S1 and has not taken it
  const behind = { ...plan, semesters: [sem('Y1S1', ['IS114']), sem('Y1S2', []), sem('Y2S1', ['IS210']), sem('Y2S2', []), sem('Y3S1', [])] }
  const result = layoutCurriculum(buildCurriculumChecklist(behind, catalogue, bundle), behind, bundle, { majorCode: 'BSC-IS' })
  const lateRows = [...result.groups.flatMap((g) => g.slots), ...result.other].filter((r) => r.urgency === 'late')
  assert.deepEqual(lateRows.map((r) => r.id), ['WRITING'])
  assert.ok(lateRows.every((r) => r.status === 'todo'))
  assert.equal(result.totals.late, 1)
})

test('a course that counts for two requirements (an additional track and an IS elective) is counted once in the totals', () => {
  // Fintech is an additional track: its compulsory course IS444 may also count as an IS elective. In the plan once, it is one course.
  const two = { ...bundle, tracks: [
    bundle.tracks[0],
    { _id: 'BSC-IS_AY2025_FT', trackCode: 'FT', name: 'Financial Technology', requirements: [req('FT_COMP', 'track', { ownerId: 'BSC-IS_AY2025_FT', label: '1 Compulsory Track Course', rule: 'all', modules: ['IS444'], countsToward: 'MAJOR_ELECTIVES' })] },
  ] }
  const cat = { ...catalogue, ...Object.fromEntries([mod('IS444', [], ['IS', 'IS_TRACK'])]) }
  const p = { ...plan, tracks: ['BA', 'FT'], semesters: [sem('Y1S1', []), sem('Y1S2', []), sem('Y2S1', []), sem('Y2S2', ['IS444']), sem('Y3S1', [])] }
  const built2 = buildCurriculumChecklist(p, cat, two)
  const rows2 = built2.groups.flatMap((g) => g.slots)
  // the builder itself lets IS444 tick both requirements, as designed
  assert.equal(rows2.find((r) => r.id === 'FT_COMP').status, 'planned')
  assert.equal(rows2.find((r) => r.id === 'IS_ELECT').taken.some((t) => t.code === 'IS444'), true)
  const result = layoutCurriculum(built2, p, two, { majorCode: 'BSC-IS' })
  // ...but the totals count the one course once: planned 1, not 2
  assert.equal(result.totals.planned, 1)
  const credited = result.groups.flatMap((g) => g.slots).filter((r) => r.credit?.planned && !r.extra)
  assert.equal(credited.length, 1)
  assert.equal(credited[0].id, 'IS_ELECT', 'an additional track claims nothing: the course counts once, as an IS elective')
})

test("a second track's courses count once toward the electives, and its rows add nothing to the total", () => {
  // BA is the main track; Product Development (PD) is the additional one. Its rows show progress, but the degree total
  // stays the same: its courses fill the "Any IS course" and free elective rows.
  const cat = { ...catalogue, ...Object.fromEntries([mod('P1', [], ['IS']), mod('P2', [], ['IS']), mod('P3', [], [])]) }
  const withPd = { ...bundle, tracks: [
    bundle.tracks[0],
    { _id: 'BSC-IS_AY2025_PD', trackCode: 'PD', name: 'Product Development', requirements: [
      req('PD_COMP', 'track', { ownerId: 'BSC-IS_AY2025_PD', label: 'Any 1 Compulsory Track Course', rule: 'chooseN', n: 1, modules: ['P1'], countsToward: 'MAJOR_ELECTIVES' }),
      req('PD_PICK', 'track', { ownerId: 'BSC-IS_AY2025_PD', label: 'Any 2 Track Courses', rule: 'chooseN', n: 2, cuRequired: 2, modules: ['P2', 'P3'], countsToward: 'MAJOR_ELECTIVES' }),
    ] },
  ] }
  const p = { ...plan, tracks: ['BA', 'PD'], semesters: [sem('Y1S1', []), sem('Y1S2', []), sem('Y2S1', ['P1']), sem('Y2S2', ['P2', 'P3']), sem('Y3S1', [])] }
  const built3 = buildCurriculumChecklist(p, cat, withPd)
  const raw = built3.groups.flatMap((g) => g.slots)
  const result = layoutCurriculum(built3, p, withPd, { majorCode: 'BSC-IS' })
  const laid3 = result.groups.flatMap((g) => g.slots)
  const get = (id) => laid3.find((r) => r.id === id)
  assert.match(get('PD_PICK').detail, /2 \/ 2 CU included.*P2, P3/)
  assert.equal(get('PD_PICK').status, 'planned')
  assert.equal(get('PD_COMP').status, 'inProgress')
  // the PD rows still show their own progress
  // ...and the generic rows hold the same courses, so each course is counted once in the totals
  assert.match(get('IS_ELECT').detail, /P1/)
  assert.match(get('FREE').detail, /P2, P3/)
  assert.equal(get('IS_ELECT').status, 'inProgress')
  const base = layoutCurriculum(buildCurriculumChecklist({ ...p, tracks: ['BA'] }, cat, { ...withPd, tracks: [withPd.tracks[0]] }), { ...p, tracks: ['BA'] }, { ...withPd, tracks: [withPd.tracks[0]] }, { majorCode: 'BSC-IS' })
  assert.equal(result.totals.required, base.totals.required, 'a second track does not raise the number of courses required')
  assert.equal(result.totals.inProgress + result.totals.planned + result.totals.cleared + result.totals.todo, result.totals.required)
})
