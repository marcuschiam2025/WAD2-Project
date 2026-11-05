import test from 'node:test'
import assert from 'node:assert/strict'
import { alreadyTaken } from '../src/core/utils/roomEligibility.js'
import { alreadyTaken as serverRule } from '../../backend/features/parties/utils/eligibility.js'

test('finished, exempted and in-progress modules count as taken, planned ones do not, on both sides', () => {
  const profile = { completedModules: ['IS111'], exempted: ['WRIT001'], currentSem: 'Y2S1', takenBySem: { Y1S2: ['CS412 → IS112'], Y2S1: ['IS216'], Y2S2: ['IS442'] } }
  const expected = { IS111: true, WRIT001: true, IS112: true, IS216: true, IS442: false, IS213: false }
  for (const [code, taken] of Object.entries(expected)) {
    assert.equal(alreadyTaken(profile, code), taken, code)
    assert.equal(serverRule(profile, code), taken, `${code} on the server`)
  }
  assert.equal(alreadyTaken({}, 'IS111'), false, 'nothing saved yet')
  assert.equal(serverRule({}, 'IS111'), false)
})

test('a current-semester module can get a room for that semester\'s term only, on both sides', () => {
  const profile = { intakeYear: 2025, completedModules: ['IS111'], currentSem: 'Y2S2', takenBySem: { Y1S2: ['IS111'], Y2S2: ['IS442'] } }
  const cases = [['IS442', '2026-27_T2', false], ['IS442', '2027-28_T1', true], ['IS111', '2026-27_T2', true]]
  for (const [code, term, taken] of cases) {
    assert.equal(alreadyTaken(profile, code, term), taken, `${code} ${term}`)
    assert.equal(serverRule(profile, code, term), taken, `${code} ${term} on the server`)
  }
})
