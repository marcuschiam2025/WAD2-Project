import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSection, canonicalTerm, termLabel } from './sectionData.js'
import { findClashes, findExamClashes } from './clash.js'
const shared = {moduleCode:'IS216',termKey:'2026-27_T1',sectionCode:'G11',instructor:'JASON CHUI',classSlots:[{day:'THU',start:'12:00',end:'13:30',venue:'SCIS1'},{day:'FRI',start:'12:00',end:'13:30',venue:'SCIS1'}],finalExam:{date:'2026-11-24T16:00:00.000Z',start:'09:00',end:'11:00'}}
test('adapts shared sections without losing a second meeting or Singapore exam date',()=>{
 const s=normalizeSection(shared)
 assert.equal(s.sectionId,'2026-27_T1:IS216:G11')
 assert.equal(s.term,'2026-27_T1')
 assert.deepEqual(s.sessions.map(({day,start,end})=>({day,start,end})),[{day:3,start:'12:00',end:'13:30'},{day:4,start:'12:00',end:'13:30'}])
 assert.equal(s.examPeriod.date,'2026-11-25')
 assert.equal(s.prof,'JASON CHUI')
 assert.equal(canonicalTerm('AY24/25 T2'),'2024-25_T2')
 assert.equal(termLabel('2026-27_T1'),'AY26/27 T1')
})
test('supports existing legacy sections without changing their saved IDs',()=>{
 const s=normalizeSection({sectionId:'IS212-G1',module:'IS212',section:'G1',term:'AY24/25 T2',day:0,slot:1})
 assert.equal(s.sectionId,'IS212-G1')
 assert.deepEqual(s.sessions,[{day:0,start:'12:00',end:'15:15',venue:undefined,slot:1}])
})
test('checks exact overlapping meetings rather than treating a whole display band as occupied',()=>{
 const a=normalizeSection(shared)
 const b=normalizeSection({...shared,moduleCode:'IS111',sectionCode:'G1',classSlots:[{day:'FRI',start:'13:00',end:'14:30'}]})
 const c=normalizeSection({...shared,moduleCode:'IS112',sectionCode:'G1',classSlots:[{day:'FRI',start:'13:30',end:'15:00'}]})
 assert.deepEqual(findClashes([a,b]),[[a.sectionId,b.sectionId]])
 assert.deepEqual(findClashes([a,c]),[])
 assert.deepEqual(findExamClashes([a,b]),[[a.sectionId,b.sectionId]])
})
test('rejects malformed meeting data rather than silently dropping a class',()=>{
 assert.throws(()=>normalizeSection({...shared,classSlots:[{day:'BAD',start:'12:00',end:'13:30'}]}))
 assert.throws(()=>normalizeSection({...shared,classSlots:[{day:'MON',start:'14:00',end:'13:30'}]}))
})

test('exam wording: an exam time, no final exam (null), or not yet announced (missing)', async () => {
  const { normalizeSection, NO_FINAL_EXAM, EXAM_NOT_ANNOUNCED } = await import('./sectionData.js')
  const { findExamClashes } = await import('./clash.js')
  const base = { sectionId: 'IS442-G1', module: 'IS442', section: 'G1', term: 'AY26/27 T2', meetings: [{ day: 2, start: '19:00', end: '22:15' }] }
  const dated = normalizeSection({ ...base, finalExam: { date: new Date('2027-04-20T00:00:00+08:00'), start: '08:30', end: '10:30' } })
  assert.equal(dated.exam, '2027-04-20 · 08:30 – 10:30')
  assert.equal(normalizeSection({ ...base, finalExam: null }).exam, NO_FINAL_EXAM)
  const a = normalizeSection(base)
  const b = normalizeSection({ ...base, sectionId: 'IS111-G1', module: 'IS111' })
  assert.equal(a.exam, EXAM_NOT_ANNOUNCED)
  assert.deepEqual(findExamClashes([a, b]), []) // two unannounced exams are not a clash
})
