import test from 'node:test'
import assert from 'node:assert/strict'
import { roomCalendar } from '../src/core/utils/roomCalendar.js'

test('room calendar places every live meeting, including weekends, without changing ballot IDs', async () => {
  const a = { section: { id: '2026:IS216:G1', section: 'G1', sessions: [{ day: 0, start: '08:15', end: '09:45', venue: 'A' }, { day: 5, start: '14:00', end: '15:30', venue: 'B' }] }, count: 2, voters: [{ name: 'Noah' }] }
  const b = { section: { id: '2026:IS216:G2', section: 'G2', sessions: [{ day: 0, start: '08:15', end: '09:45' }] }, count: 1, voters: [] }
  const rows = roomCalendar([a, b])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].start, '08:15')
  assert.deepEqual(rows[0].days[0].map(event => event.section.id), [a.section.id, b.section.id])
  assert.equal(rows[0].days[0][0].count, 2)
  assert.equal(rows[1].days[5][0].section.id, a.section.id)
  assert.equal(rows[1].days[5][0].meeting.venue, 'B')
  assert.deepEqual(rows[1].days[6], [])
  assert.deepEqual(roomCalendar([]), [])
})
