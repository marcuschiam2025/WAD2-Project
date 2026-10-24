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
