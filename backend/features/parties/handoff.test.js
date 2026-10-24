import test from 'node:test'
import assert from 'node:assert/strict'

test('handoff checks prerequisites, corequisites, exclusions and existing class/exam clashes', async () => {
  const { validateRoomHandoff } = await import('./utils/handoff.js').catch(() => ({}))
  assert.equal(typeof validateRoomHandoff, 'function', 'room handoff validation is required')
  const section = { sectionId: 'g1', module: 'IS216', sessions: [{ day: 0, start: '08:15', end: '09:45' }], examPeriod: { date: '2026-11-01', start: '09:00', end: '11:00' } }
  const module = { _id: 'IS216', prerequisites: [['IS111']], corequisites: [['IS112']], mutuallyExclusive: ['CS216'] }
  const options = { module, section, completed: ['IS111', 'IS112'], others: [] }
  assert.doesNotThrow(() => validateRoomHandoff(options))
  assert.throws(() => validateRoomHandoff({ ...options, completed: [] }), /prerequisite/i)
  assert.throws(() => validateRoomHandoff({ ...options, completed: ['IS111'] }), /corequisite/i)
  assert.throws(() => validateRoomHandoff({ ...options, completed: [...options.completed, 'CS216'] }), /exclu/i)
  assert.throws(() => validateRoomHandoff({ ...options, others: [{ ...section, module: 'IS999', sectionId: 'g2' }] }), /clash/i)
  assert.throws(() => validateRoomHandoff({ ...options, others: [{ ...section, module: 'IS999', sectionId: 'g2', sessions: [{ day: 1, start: '08:15', end: '09:45' }] }] }), /exam/i)
  assert.throws(() => validateRoomHandoff({ ...options, module: { ...module, prerequisiteRules: [{ countFrom: ['IS999', 'IS998'], n: 1 }] } }), /prerequisite/i)
})
