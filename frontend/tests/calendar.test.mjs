import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'

test('calendar export preserves all exact weekly meetings, dates, unique IDs and escaped text',async()=>{
 const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'})
 try {
  const {buildIcs}=await server.ssrLoadModule('/src/core/utils/ics.js')
  const rows=[{id:'2026-27_T1:IS216:G11',module:'IS216',section:'G11',name:'Web, apps; test\nNew line',sessions:[{day:3,start:'12:00',end:'13:30',venue:'Room A'},{day:4,start:'12:00',end:'13:30',venue:'Room B'}]}]
  const ics=buildIcs(rows,'2026-08-17',13)
  assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,2)
  assert.ok(ics.includes('DTSTART;TZID=Asia/Singapore:20260820T120000'))
  assert.ok(ics.includes('DTEND;TZID=Asia/Singapore:20260821T133000'))
  assert.equal(new Set(ics.match(/^UID:.*$/gm)).size,2)
  assert.ok(ics.includes('Web\\, apps\\; test\\nNew line'))
  assert.ok(ics.includes('COUNT=13'))
  assert.throws(()=>buildIcs(rows,'2026-08-18',13),/Monday/)
  assert.throws(()=>buildIcs(rows,'2026-02-30',13),/date/)
  assert.throws(()=>buildIcs(rows,'2026-08-17',0),/weeks/)
  assert.throws(()=>buildIcs([], '2026-08-17',13),/sections/)
 } finally {await server.close()}
})

test('calendar export uses each section\'s own teaching dates and only needs a Monday for sections without them',async()=>{
 const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'})
 try {
  const {buildIcs,hasTeachingDates}=await server.ssrLoadModule('/src/core/utils/ics.js')
  const dated={id:'IS442-G1',module:'IS442',section:'G1',name:'Enterprise Solution Delivery',startDate:'2027-01-11',endDate:'2027-04-18',sessions:[{day:2,start:'19:00',end:'22:15',venue:'SCIS SR 3-4'}]}
  const ics=buildIcs([dated])
  assert.ok(ics.includes('DTSTART;TZID=Asia/Singapore:20270113T190000'))
  assert.ok(ics.includes('RRULE:FREQ=WEEKLY;UNTIL=20270418T155959Z'))
  assert.ok(!ics.includes('COUNT='))
  assert.equal(hasTeachingDates({startDate:'2027-02-30',endDate:'2027-04-18'}),false)
  const undated={...dated,id:'IS111-G1',module:'IS111',startDate:null,endDate:null}
  assert.throws(()=>buildIcs([dated,undated]),/date/)
  assert.ok(buildIcs([dated,undated],'2027-01-11',13).includes('COUNT=13'))
 } finally {await server.close()}
})

test('exam clash check ignores sections whose exam is unannounced or that have no final exam',async()=>{
 const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'})
 try {
  const {findExamClashes}=await server.ssrLoadModule('/src/core/utils/clash.js')
  const row=(id,exam,examPeriod=null)=>({id,module:id,section:'G1',exam,examPeriod,sessions:[]})
  assert.deepEqual(findExamClashes([row('A','Exam not yet announced'),row('B','Exam not yet announced')]),[])
  assert.deepEqual(findExamClashes([row('A','No final exam'),row('B','No final exam')]),[])
  const exam={date:'2027-04-20',start:'13:00',end:'15:00'}
  assert.equal(findExamClashes([row('A','x',exam),row('B','y',{...exam,start:'14:30',end:'16:30'})]).length,1)
 } finally {await server.close()}
})
