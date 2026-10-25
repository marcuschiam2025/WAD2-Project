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

test('Google export repeats catalogue sections from their own start date until their end date',async()=>{
 const originalFind=Section.collection.find, originalFetch=globalThis.fetch
 const events=[]
 const row={sectionId:'IS442-G1',module:'IS442',section:'G1',term:'AY26/27 T2',instructors:['BIN ZHU'],meetings:[{day:2,start:'19:00',end:'22:15',venue:'SCIS SR 3-4'}],startDate:'2027-01-11',endDate:'2027-04-18'}
 Section.collection.find=()=>({toArray:async()=>[row]})
 globalThis.fetch=async(_url,request)=>{events.push(JSON.parse(request.body));return {ok:true,json:async()=>({id:'event-1'})}}
 let response
 const res={status:code=>{assert.equal(code,201);return {json:data=>{response=data}}}}
 try {
  await exportTimetable({body:{accessToken:'test-token',sectionIds:['IS442-G1']}},res)
  assert.equal(events.length,1)
  assert.equal(events[0].start.dateTime,'2027-01-13T19:00:00') // first Wednesday on or after Mon 11 Jan
  assert.equal(events[0].end.dateTime,'2027-01-13T22:15:00')
  assert.deepEqual(events[0].recurrence,['RRULE:FREQ=WEEKLY;UNTIL=20270418T155959Z'])
  assert.match(events[0].description,/Added by BidMaxxer/)
  assert.equal(response.created,1)
 } finally {Section.collection.find=originalFind;globalThis.fetch=originalFetch}
})

test('Google export needs termStart only for sections without dates, and explains a refused token',async()=>{
 const originalFind=Section.collection.find, originalFetch=globalThis.fetch
 const undated={sectionId:'IS111-G1',module:'IS111',section:'G1',term:'AY26/27 T2',meetings:[{day:0,start:'08:15',end:'11:30'}]}
 const dated={...undated,sectionId:'IS112-G1',module:'IS112',startDate:'2027-01-11',endDate:'2027-04-18'}
 let rows=[undated]
 Section.collection.find=()=>({toArray:async()=>rows})
 globalThis.fetch=async()=>({ok:false,status:403})
 const res={status:()=>({json:()=>{}})}
 try {
  await assert.rejects(exportTimetable({body:{accessToken:'t',sectionIds:['IS111-G1']}},res),error=>error.status===400&&/IS111/.test(error.message))
  rows=[dated]
  await assert.rejects(exportTimetable({body:{accessToken:'t',sectionIds:['IS112-G1']}},res),error=>error.status===403&&/not granted/.test(error.message))
 } finally {Section.collection.find=originalFind;globalThis.fetch=originalFetch}
})
