import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCurriculumChecklist, curriculumCandidates } from '../src/core/utils/curriculumChecklist.js'
const mods = Object.fromEntries([
  ['A', 1, ['CORE:X'], ['IS']], ['B', 0.5, [], ['IS']], ['C', 1, [], ['IS']], ['D', 1, ['GRAD:X'], []],
].map(([code, cu, fulfils, categories]) => [code, { code, name: code, cu, fulfils, categories }]))
const plan = { majorId: 'IS2025', tracks: ['BA'], currentSem: 'Y2S1', semesters: [{ id: 'Y1S1', modules: ['A'] }, { id: 'Y2S1', modules: ['B'] }, { id: 'Y2S2', modules: ['C', 'D'] }] }
const bundle = { majorId: 'IS2025', requirements: [
  { _id: 'CORE', level: 'core', label: 'Core rule', heading: 'Capabilities', rule: 'all', modules: ['A'], cuRequired: 1 },
  { _id: 'ELECT', level: 'major', label: 'IS electives', rule: 'anyFromCategory', categories: ['IS'], cuRequired: 2 },
  { _id: 'FLAG', level: 'core', label: 'Graduation', rule: 'flag', tag: 'GRAD:X', cuRequired: 0 },
], tracks: [] }
test('live checklist follows stored labels and credit rules without counting a course twice', () => {
  const c = buildCurriculumChecklist(plan, mods, bundle)
  const rows = c.groups.flatMap(g => g.slots)
  assert.equal(rows.find(r => r.id === 'CORE').status, 'cleared')
  assert.equal(rows.find(r => r.id === 'ELECT').status, 'todo')
  assert.match(rows.find(r => r.id === 'ELECT').detail, /1.5.*2 CU/)
  assert.equal(c.other[0].status, 'planned')
  const edited = structuredClone(bundle)
  edited.requirements[0].label = 'Updated core'; edited.requirements[0].modules = ['D']
  const changed = buildCurriculumChecklist(plan, mods, edited)
  assert.equal(changed.groups[0].slots[0].label, 'Updated core')
  assert.equal(changed.groups[0].slots[0].status, 'planned')
  assert.deepEqual(curriculumCandidates(changed.groups[0].slots[0], mods).map(m => m.code), ['D'])
})
test('choice counts, flags, exemptions and curriculum ownership stay explicit', () => {
  const b = { ...bundle, requirements: [{ _id: 'CH', level: 'major', label: 'Choose two', rule: 'chooseN', n: 2, modules: ['A', 'C'], cuRequired: 1 }] }
  const partial = { ...plan, semesters: [{ id: 'Y2S1', modules: ['A'] }] }
  assert.equal(buildCurriculumChecklist(partial, mods, b).groups[0].slots[0].status, 'todo')
  assert.equal(buildCurriculumChecklist(partial, mods, b, { exempted: ['C'] }).groups[0].slots[0].status, 'inProgress')
  assert.throws(() => buildCurriculumChecklist(plan, mods, { ...bundle, majorId: 'OTHER' }), /curriculum/i)
  const auto = { ...bundle, requirements: [{ _id: 'F', rule: 'flag', label: 'Automatic', autoFulfilled: true }] }
  assert.equal(buildCurriculumChecklist(plan, mods, auto).other[0].status, 'cleared')
})

test('an internship placed in an LOA semester is retained by live requirements', () => {
  const p = { majorId: 'IS2025', currentSem: 'Y2S1', semesters: [{ id: 'Y1S1', loa: true, modules: ['INTERN'] }, { id: 'Y2S1', modules: [] }] }
  const b = { majorId: 'IS2025', requirements: [{ _id: 'INTERN_RULE', level: 'core', label: 'Internship', rule: 'basket', tag: 'CORE:INTERNSHIP', cuRequired: 1 }], tracks: [] }
  const c = buildCurriculumChecklist(p, { INTERN: { code: 'INTERN', cu: 1, fulfils: ['CORE:INTERNSHIP'] } }, b)
  assert.equal(c.groups[0].slots[0].status, 'cleared')
})

test('partial live requirements use a neutral progress label instead of a semester recommendation', () => {
  const row = buildCurriculumChecklist(plan, mods, bundle).groups.flatMap(g => g.slots).find(r => r.id === 'ELECT')
  assert.equal(row.chip.text, 'Partial')
  assert.equal(row.chip.tone, 'neutral')
  assert.equal(row.rec, null, 'no recommended semester is provided by the stored rule')
})

test('requirements met by profile exemptions alone show as exempted, mixed ones as cleared', () => {
  const noA = { ...plan, semesters: [{ id: 'Y1S1', modules: [] }, { id: 'Y2S1', modules: [] }, { id: 'Y2S2', modules: [] }] }
  const c = buildCurriculumChecklist(noA, mods, bundle, { exempted: ['A'] })
  const core = c.groups.flatMap(g => g.slots).find(r => r.id === 'CORE')
  assert.equal(core.status, 'exempted')
  assert.equal(core.chip.text, 'Exempted')
  assert.equal(core.chip.tone, 'exempted')
  assert.equal(c.totals.exempted, 1)
  // A cleared in a semester and also exempted: the exemption wins, still exempted
  assert.equal(buildCurriculumChecklist(plan, mods, bundle, { exempted: ['A'] }).groups[0].slots[0].status, 'exempted')
  // Not exempted: a normal cleared requirement
  assert.equal(buildCurriculumChecklist(plan, mods, bundle).totals.exempted, 0)
})
test('with no track chosen, one row holds the track courses so the total stays the same', () => {
  const tracks = [
    { _id: 'T1', trackCode: 'BA', name: 'BA', requirements: [{ _id: 'T1R', level: 'track', label: 'Any 2', rule: 'chooseN', n: 2, modules: ['A', 'C'], cuRequired: 2 }] },
    { _id: 'T2', trackCode: 'FT', name: 'FT', requirements: [{ _id: 'T2R', level: 'track', label: 'Any 2', rule: 'chooseN', n: 2, modules: ['C', 'D'], cuRequired: 2 }] },
  ]
  const b = { ...bundle, requirements: [{ _id: 'ELECT', level: 'major', label: 'IS electives', rule: 'anyFromCategory', categories: ['IS'], cuRequired: 2 }], tracks }
  const undecided = buildCurriculumChecklist({ ...plan, tracks: [] }, mods, b)
  const row = undecided.groups.flatMap(g => g.slots).find(r => r.id === 'undecided-track')
  assert.equal(row.requirement.cuRequired, 2)
  assert.deepEqual(row.taken.map(t => t.code), ['A', 'C'], 'courses from any track count here before the electives')
  assert.deepEqual(curriculumCandidates(row, mods).map(m => m.code), ['A', 'C', 'D'])
  const chosen = buildCurriculumChecklist({ ...plan, tracks: ['BA'] }, mods, b)
  assert.ok(!chosen.groups.flatMap(g => g.slots).some(r => r.id === 'undecided-track'), 'the row goes once a track is chosen')
  assert.equal(undecided.totals.required, chosen.totals.required)
  assert.ok(!buildCurriculumChecklist({ ...plan, tracks: [] }, mods, bundle).groups.flatMap(g => g.slots).some(r => r.id === 'undecided-track'), 'a major with no tracks gets no row')
})
