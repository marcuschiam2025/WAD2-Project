import test from 'node:test'
import assert from 'node:assert/strict'
import { semestersDue } from './academicCalendar.js'
import { profileUpdate } from './profile.js'

const student = { onboarded: true, currentSem: 'Y2S1', createdAt: new Date('2026-10-01T00:00:00Z') }

test('a semester is due only from midnight Singapore time after its exams end', () => {
  assert.equal(semestersDue(student, new Date('2026-12-06T15:59:59Z')), 0)
  assert.equal(semestersDue(student, new Date('2026-12-06T16:00:00Z')), 1)
})
test('someone away for a long time is owed every semester that ended', () => {
  assert.equal(semestersDue(student, new Date('2027-06-01T00:00:00Z')), 2)
})
test('setting the semester counts from then, so a correction is not moved again', () => {
  const corrected = { ...student, semesterCheckedAt: new Date('2026-12-08T00:00:00Z') }
  assert.equal(semestersDue(corrected, new Date('2026-12-09T00:00:00Z')), 0)
  assert.ok(profileUpdate({ currentSem: 'Y2S1' }, {}).semesterCheckedAt instanceof Date)
  assert.equal(profileUpdate({ name: 'A' }, {}).semesterCheckedAt, undefined)
})
test('students who have not finished onboarding are left alone', () => {
  assert.equal(semestersDue({ ...student, onboarded: false }, new Date('2027-06-01T00:00:00Z')), 0)
  assert.equal(semestersDue({ ...student, currentSem: undefined }, new Date('2027-06-01T00:00:00Z')), 0)
})
