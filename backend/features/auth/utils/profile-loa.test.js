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
