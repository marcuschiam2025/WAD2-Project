import test from 'node:test'
import assert from 'node:assert/strict'
import { profileUpdate } from './profile.js'

test('derives completed courses from earlier semesters and exemptions, never current/future classes', () => {
 const result=profileUpdate({currentSem:'Y2S1',takenBySem:{Y1S1:[' is111 '],Y2S1:['IS216'],Y2S2:['IS424']},exempted:['IS112'],role:'admin',firebaseUid:'other',onboarded:true,intakeYear:2025,balance:100}, {})
 assert.deepEqual(result.completedModules,['IS111','IS112'])
 assert.equal(result.role,undefined)
 assert.equal(result.firebaseUid,undefined)
 assert.equal(result.yearOfStudy,2)
})
test('rejects invalid profile data rather than saving misleading progress',()=>{
 for(const body of [{currentSem:'bad'},{intakeYear:0},{balance:-1},{takenBySem:[]},{takenBySem:{Y1S1:'IS111'}},{freeExemptions:7},{onboarded:'yes'}]) assert.throws(()=>profileUpdate(body,{}))
})
test('a later exemption edit recomputes completions using persisted semester data',()=>{
 assert.deepEqual(profileUpdate({exempted:['IS112']},{currentSem:'Y2S1',takenBySem:{Y1S1:['IS111'],Y2S1:['IS216']}}).completedModules,['IS111','IS112'])
})
test('preserves completion flag identifiers and ignores privilege changes', () => {
 assert.deepEqual(profileUpdate({markedDone:['internship','exposure'],role:'admin'},{}), {markedDone:['internship','exposure']})
 assert.throws(() => profileUpdate({markedDone:['admin']},{}))
})
