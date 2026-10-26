import test from 'node:test'
import assert from 'node:assert/strict'

const header = ['Term / Session', 'Course Code', 'Pattern', 'Exam Date', 'Start Time', 'End Time']
const row = (code, pattern = 'EXAM', date = '20/04/2027', start = '8:30AM', end = '') => ['2026-27 Term 2 / 1', code, pattern, date, start, end]

test('exam import preserves incomplete and invalid courses, and only explicit NO EXAM rows clear exams', async () => {
  const { buildExamImport } = await import('./examImport.js').catch(() => ({}))
  assert.equal(typeof buildExamImport, 'function', 'exam imports need a database-independent validation plan')
  const result = buildExamImport([[header, row('PARTIAL'), row('NONE', 'NO EXAM'), row('BAD_DATE', 'EXAM', '31/02/2027'), row('BAD_TIME', 'EXAM', '20/04/2027', '13:00PM'), row('UNKNOWN', 'TBA'), row('CONFLICT', 'NO EXAM'), row('CONFLICT', 'EXAM', '', '')]])
  assert.deepEqual(result.updates.map(u => u.module), ['PARTIAL', 'NONE'])
  const partial = result.updates[0].update.$set.finalExam
  assert.equal(partial.date.toISOString(), '2027-04-19T16:00:00.000Z')
  assert.equal(partial.start, '08:30')
  assert.equal(partial.end, null)
  assert.equal(partial.endVerified, false)
  const protection = result.updates[0].filter.$and.find(c => c.$nor)?.$nor[0]
  assert.equal(protection['finalExam.endVerified'], true, 'an incomplete source cannot overwrite a known end for the same exam')
  assert.equal(protection['finalExam.start'], '08:30')
  assert.equal(protection['finalExam.date'].toISOString(), partial.date.toISOString())
  assert.equal(result.updates[1].update.$set.finalExam, null)
  assert.ok(result.updates.every(u => u.filter.$and.some(c => c.examSource?.$ne === 'admin')), 'staff exam edits stay protected by the write filter')
  assert.equal(result.issues.length, 4)
  assert.throws(() => buildExamImport([[['Course Code'], ['IS216']]]), /column/i)
  const withoutEndColumn = buildExamImport([[header.slice(0, 5), row('NO_END_COLUMN').slice(0, 5)]])
  assert.equal(withoutEndColumn.updates[0].update.$set.finalExam.end, null, 'existing start-only exports remain supported')
})

test('verified end times survive aggregation and conflicting or invalid end times are not imported', async () => {
  const { buildExamImport } = await import('./examImport.js').catch(() => ({}))
  assert.equal(typeof buildExamImport, 'function')
  const result = buildExamImport([
    [header, row('KNOWN', 'EXAM', '20/04/2027', '8:30AM', '11:30AM'), row('KNOWN'), row('BAD_END', 'EXAM', '20/04/2027', '8:30AM', '8:00AM')],
    [header, row('DIFFERENT', 'EXAM', '20/04/2027', '8:30AM', '10:30AM'), row('DIFFERENT', 'EXAM', '20/04/2027', '8:30AM', '11:30AM')],
  ])
  assert.deepEqual(result.updates.map(u => u.module), ['KNOWN'])
  assert.equal(result.updates[0].update.$set.finalExam.end, '11:30')
  assert.equal(result.updates[0].update.$set.finalExam.endVerified, true)
  assert.equal(result.issues.length, 2)
})
