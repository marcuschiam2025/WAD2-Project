import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findClashes, findMeetingClash } from './clash.js'
import { shortProf, toSectionView } from './sectionView.js'

const section = (sectionId, meetings, dates = {}) => ({ sectionId, meetings, ...dates })
const meeting = (day, start, end) => ({ day, start, end })

test('overlapping times on the same day clash', () => {
  const a = section('A', [meeting(0, '10:00', '11:30')])
  const b = section('B', [meeting(0, '08:15', '11:30')])
  assert.deepEqual(findClashes([a, b]), [['A', 'B']])
})

test('back-to-back classes and different days do not clash', () => {
  const a = section('A', [meeting(0, '08:15', '11:30')])
  const b = section('B', [meeting(0, '11:30', '13:00')])
  const c = section('C', [meeting(1, '08:15', '11:30')])
  assert.deepEqual(findClashes([a, b, c]), [])
})

test('any meeting of a twice-a-week section can clash', () => {
  const language = section('JPAN', [meeting(0, '10:00', '11:30'), meeting(3, '10:00', '11:30')])
  const other = section('IS', [meeting(3, '08:15', '11:30')])
  assert.equal(findMeetingClash(language, other).day, 3)
})

test('sections without a timetable, or running in different weeks, never clash', () => {
  const project = section('SMUX', [])
  const firstHalf = section('LAW', [meeting(0, '19:00', '22:15')], { startDate: '2027-01-11', endDate: '2027-02-28' })
  const secondHalf = section('LAW2', [meeting(0, '19:00', '22:15')], { startDate: '2027-03-01', endDate: '2027-04-18' })
  assert.deepEqual(findClashes([project, firstHalf, secondHalf]), [])
})

test('section view: first meeting, standard slot and short names', () => {
  const view = toSectionView({
    sectionId: 'IS213-G1',
    instructors: ['KELLY NGO', 'HE JIANZHONG'],
    meetings: [{ day: 1, start: '12:00', end: '15:15', venue: 'SCIS Seminar Room 2-4' }],
  })
  assert.equal(view.day, 1)
  assert.equal(view.slot, 1)
  assert.equal(view.venueShort, 'SCIS SR 2-4')
  assert.equal(view.profShort, 'K. Ngo +1')
  assert.equal(toSectionView({ sectionId: 'X', meetings: [meeting(0, '10:00', '11:30')] }).slot, null)
  assert.equal(shortProf('LEE, YUN'), 'L. Yun')
})
