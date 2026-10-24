import test from 'node:test'
import assert from 'node:assert/strict'

test('curriculum requirement validation preserves rule types and rejects invalid credit/count data', async () => {
  const { validateRequirementEdit } = await import('./curricula.service.js').catch(() => ({}))
  assert.equal(typeof validateRequirementEdit, 'function', 'curriculum validation is required')
  const data = { label: 'Any 2 courses', heading: 'Electives', order: 1, countsToward: 'MAJOR_ELECTIVES', cuRequired: 2, modules: ['IS216', 'IS217'], n: 2, revision: 0 }
  assert.deepEqual(validateRequirementEdit('chooseN', data).modules, data.modules)
  for (const bad of [{ ...data, n: 3 }, { ...data, cuRequired: -1 }, { ...data, modules: ['IS216', 'IS216'] }, { ...data, ownerId: 'OTHER' }, { ...data, rule: 'all' }]) assert.throws(() => validateRequirementEdit('chooseN', bad), { status: 400 })
  assert.throws(() => validateRequirementEdit('flag', { label: 'Exposure', order: 1, countsToward: 'NONE', cuRequired: 1, tag: 'EXPOSURE', autoFulfilled: false }), { status: 400 })
})
test('curriculum edits enforce degree/intake ownership, revision and module references in the audit session', async () => {
  const { createCurriculumEditor } = await import('./curricula.service.js').catch(() => ({}))
  assert.equal(typeof createCurriculumEditor, 'function', 'scoped curriculum editor required')
  let row = { _id: 'RULE', ownerId: 'TRACK', level: 'track', rule: 'all', label: 'Compulsory', cuRequired: 1, modules: ['IS216'], revision: 0 }, event
  const service = createCurriculumEditor({
    change: async (meta, fn) => { const result = await fn('tx'); event = { ...meta, ...result }; return result },
    major: async (id, session) => { assert.equal(session, 'tx'); return { _id: id } },
    track: async () => ({ _id: 'TRACK', majorId: 'IS_2025' }),
    requirement: async () => row,
    modules: async (codes, session) => { assert.equal(session, 'tx'); return codes.filter(c => c === 'IS216').map(_id => ({ _id })) },
    update: async (kind, before, data, session) => { assert.equal(kind, 'requirement'); assert.equal(session, 'tx'); row = { ...before, ...data, revision: before.revision + 1 }; return row },
  })
  const actor = { _id: 'staff', role: 'admin' }, input = { label: 'Updated', heading: '', order: 1, countsToward: 'MAJOR_ELECTIVES', cuRequired: 1, modules: ['IS216'], revision: 0 }
  await assert.rejects(service.save({ role: 'student' }, 'IS_2025', 'requirement', 'RULE', input), { status: 403 })
  await assert.rejects(service.save(actor, 'OTHER_2025', 'requirement', 'RULE', input), { status: 404 })
  await assert.rejects(service.save(actor, 'IS_2025', 'requirement', 'RULE', { ...input, modules: ['MISSING'] }), /Unknown module/)
  const result = await service.save(actor, 'IS_2025', 'requirement', 'RULE', input)
  assert.equal(result.ownerId, 'TRACK'); assert.equal(result.rule, 'all'); assert.equal(result.revision, 1)
  assert.equal(event.entity, 'curriculum'); assert.equal(event.before.label, 'Compulsory'); assert.equal(event.after.label, 'Updated')
  await assert.rejects(service.save(actor, 'IS_2025', 'requirement', 'RULE', input), { status: 409 })
  row = { ...row, ownerId: 'IS_2025', level: 'major' }
  await assert.rejects(service.save(actor, 'IS_2025', 'requirement', 'RULE', { ...input, revision: 1 }), /read-only/)
})
