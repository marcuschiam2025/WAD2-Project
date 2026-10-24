import test from 'node:test'
import assert from 'node:assert/strict'
import Section from '../bidding/models/Section.js'
import { exportTimetable } from './calendar.controller.js'

test('Google export uses canonical sections and emits both exact weekly meetings after validating inputs',async()=>{
 const originalFind=Section.collection.find, originalFetch=globalThis.fetch
 const events=[]
 let reads=0
 Section.collection.find=()=>{reads++;return {toArray:async()=>[{moduleCode:'IS216',sectionCode:'G11',termKey:'2026-27_T1',classSlots:[{day:'THU',start:'12:00',end:'13:30',venue:'A'},{day:'FRI',start:'12:00',end:'13:30',venue:'B'}]}]}}
 globalThis.fetch=async(_url,request)=>{events.push(JSON.parse(request.body));return {ok:true,json:async()=>({id:`event-${events.length}`})}}
 const req={body:{accessToken:'test-token',sectionIds:['2026-27_T1:IS216:G11'],termStart:'2026-08-17',weeks:13}}
 let response
 const res={status:code=>{assert.equal(code,201);return {json:data=>{response=data}}}}
 try {
  await assert.rejects(exportTimetable({...req,body:{...req.body,weeks:'13'}},res),error=>error.status===400)
  assert.equal(reads,0)
  await exportTimetable(req,res)
  assert.equal(events.length,2)
  assert.equal(events[0].start.dateTime,'2026-08-20T12:00:00')
  assert.equal(events[1].end.dateTime,'2026-08-21T13:30:00')
  assert.equal(events[1].location,'B')
  assert.equal(response.created,2)
 } finally {Section.collection.find=originalFind;globalThis.fetch=originalFetch}
})
