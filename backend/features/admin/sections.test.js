import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSection } from '../bidding/utils/sectionData.js'

const input = { moduleCode: 'IS216', termKey: '2026-27_T2', sectionCode: 'G1', instructor: 'Staff', capacity: 40, classSlots: [{ day: 'MON', start: '09:00', end: '10:30', venue: 'A' }, { day: 'FRI', start: '09:00', end: '10:30', venue: 'B' }], finalExam: { date: '2027-04-20', start: '09:00', end: '11:00', venue: 'Hall' } }
test('section validation retains all meetings, Singapore exam date and rejects bad times or identity changes', async () => {
  const { validateSectionInput } = await import('./sections.service.js').catch(() => ({}))
  assert.equal(typeof validateSectionInput, 'function', 'validated section editor required')
  const data = validateSectionInput(input)
  assert.equal(normalizeSection(data).examPeriod.date, '2027-04-20')
  assert.equal(data.classSlots.length, 2)
  for (const bad of [{ ...input, capacity: -1 }, { ...input, classSlots: [] }, { ...input, classSlots: [{ day: 'MON', start: '11:00', end: '10:00' }] }, { ...input, finalExam: { ...input.finalExam, date: '2027-02-30' } }, { ...input, classSlots: [input.classSlots[0], input.classSlots[0]] }, { ...input, revision: '0' }, { ...input, archived: true }]) assert.throws(() => validateSectionInput(bad), { status: 400 })
})
test('section updates use audit transaction and loaded revision without changing legacy section links', async () => {
  const { createSectionEditor } = await import('./sections.service.js').catch(() => ({}))
  assert.equal(typeof createSectionEditor, 'function')
  const old = { _id: 'db-row', module: 'IS216', term: 'AY26/27 T2', section: 'G1', sectionId: 'IS216-G1', day: 0, slot: 0 }
  let row = old, events = [], known = true
  const service = createSectionEditor({
    change: async (meta, fn) => { const result = await fn('tx'); events.push({ ...meta, ...result }); return result },
    read: async () => row,
    activeModule: async () => known,
    insert: async data => data,
    update: async (before, data, session) => { assert.equal(session, 'tx'); assert.equal(before, old); row = { ...before, ...data, revision: 1 }; return row },
  })
  const actor = { _id: 'staff', role: 'admin' }
  await assert.rejects(service.save({ role: 'student' }, input, true), { status: 403 })
  await assert.rejects(service.save(actor, input), { status: 400 })
  await assert.rejects(service.save(actor, input, true), { status: 409 })
  const result = await service.save(actor, { ...input, revision: 0 })
  assert.equal(result.sectionId, 'IS216-G1')
  assert.equal(normalizeSection(row).sectionId, 'IS216-G1')
  assert.equal(normalizeSection(row).sessions.length, 2)
  assert.equal(events[0].action, 'update')
  await assert.rejects(service.save(actor, { ...input, revision: 0 }), { status: 409 })
  row = null; known = false
  await assert.rejects(service.save(actor, input, true), /active module/)
})

test('archive and restore retain section identity, audit changes and reject stale or unauthorized actions', async () => {
  const { createSectionLifecycle } = await import('./sections.service.js')
  assert.equal(typeof createSectionLifecycle, 'function', 'section lifecycle is required')
  let row = { _id: 'db-row', ...input, revision: 0 }, event, active = true
  const service = createSectionLifecycle({
    change: async (meta, fn) => { const result = await fn('tx'); event = { ...meta, ...result }; return result },
    read: async () => row,
    activeModule: async () => active,
    update: async (before, data, session) => { assert.equal(session, 'tx'); row = { ...before, ...data, revision: before.revision + 1 }; return row },
  })
  const identity = { moduleCode: 'IS216', termKey: '2026-27_T2', sectionCode: 'G1' }, actor = { role: 'admin', _id: 'staff' }
  await assert.rejects(service.apply({ role: 'student' }, identity, { revision: 0 }, true), { status: 403 })
  await assert.rejects(service.apply(actor, identity, {}, true), { status: 400 })
  const archived = await service.apply(actor, identity, { revision: 0 }, true)
  assert.equal(archived.archived, true)
  assert.equal(event.action, 'archive')
  assert.equal(archived.sectionId, '2026-27_T2:IS216:G1')
  await assert.rejects(service.apply(actor, identity, { revision: 0 }, false), { status: 409 })
  active = false
  await assert.rejects(service.apply(actor, identity, { revision: 1 }, false), /active module/)
  active = true
  const restored = await service.apply(actor, identity, { revision: 1 }, false)
  assert.equal(restored.archived, false)
  assert.equal(restored.sectionId, archived.sectionId)
  assert.equal(event.after.revision, 2)
})
