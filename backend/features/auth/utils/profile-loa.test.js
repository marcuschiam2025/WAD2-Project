import test from 'node:test'
import assert from 'node:assert/strict'
import { profileUpdate } from './profile.js'
import User from '../models/User.js'

test('historical LOA is persisted without requiring courses and does not invent completed modules', () => {
  const data = profileUpdate({ currentSem: 'Y2S1', takenBySem: { Y1S1: ['IS111'] }, loaSemesters: ['Y1S2'], exempted: [] })
  assert.deepEqual(data.loaSemesters, ['Y1S2'])
  assert.deepEqual(data.completedModules, ['IS111'])
  const user = new User({ firebaseUid: 'test', email: 'test@smu.edu.sg', ...data })
  assert.equal(user.validateSync(), undefined)
  assert.deepEqual(user.toObject().loaSemesters, ['Y1S2'])
  assert.deepEqual(profileUpdate({ takenBySem: { Y1S1: ['IS111'], Y1S2: ['COR1001'] } }, data).completedModules, ['IS111', 'COR1001'])
  assert.deepEqual(profileUpdate({ loaSemesters: [] }, data).loaSemesters, [])
})

test('LOA profile validation rejects current/future terms, extra terms, duplicates and regular classes', () => {
  const current = { currentSem: 'Y3S1', takenBySem: {} }
  for (const loaSemesters of ['Y1S1', ['Y1S1', 'Y1S1'], ['Y1S1', 'Y1S2', 'Y2S1'], ['Y3S1'], ['Y3S2'], ['Y0S1']]) {
    assert.throws(() => profileUpdate({ loaSemesters }, current), /LOA|semester/i)
  }
  const saved = { currentSem: 'Y2S1', loaSemesters: ['Y1S2'], takenBySem: {} }
  assert.throws(() => profileUpdate({ takenBySem: { Y1S2: ['IS111'] } }, saved), /LOA/i)
  assert.throws(() => profileUpdate({ currentSem: 'Y1S2' }, saved), /LOA/i)
  assert.deepEqual(profileUpdate({ currentSem: 'Y1S2', loaSemesters: [] }, saved).loaSemesters, [])
  assert.deepEqual(profileUpdate({ currentSem: 'Y2S1', takenBySem: {} }).completedModules, [], 'older profiles without LOA fields remain supported')
})

test('onboarding cannot be marked complete without the details the form requires', () => {
  const finished = { onboarded: true, major: 'Information Systems', intakeYear: 2025, currentSem: 'Y2S1', takenBySem: { Y1S1: ['IS111'], Y1S2: ['IS112'] } }
  assert.equal(profileUpdate(finished, {}).onboarded, true)
  assert.throws(() => profileUpdate({ onboarded: true }, { major: 'Information Systems' }), /degree details/)
  assert.throws(() => profileUpdate({ ...finished, intakeYear: undefined }, {}), /degree details/)
  assert.throws(() => profileUpdate({ ...finished, currentSem: undefined }, {}), /degree details/)
  assert.throws(() => profileUpdate({ ...finished, takenBySem: { Y1S1: ['IS111'] } }, {}), /Y1S2/)
  // A leave of absence needs no modules, and details already saved count
  assert.equal(profileUpdate({ ...finished, takenBySem: { Y1S1: ['IS111'] }, loaSemesters: ['Y1S2'] }, {}).onboarded, true)
  assert.equal(profileUpdate({ onboarded: true }, { major: 'IS', intakeYear: 2025, currentSem: 'Y1S1' }).onboarded, true)
  // Someone already onboarded is not blocked, and leaving the flag off checks nothing
  assert.equal(profileUpdate({ onboarded: true }, { onboarded: true }).onboarded, true)
  assert.equal(profileUpdate({ name: 'A' }, {}).name, 'A')
})
