import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'
test('live multi-meeting sections drive clashes, minimum bids, saved carts and honest round dates',async()=>{
 globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}}
 const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'})
 try {
  const {useUserStore}=await server.ssrLoadModule('/src/core/stores/user.js')
  const {usePlannerStore}=await server.ssrLoadModule('/src/core/stores/planner.js')
  const {useBiddingStore}=await server.ssrLoadModule('/src/core/stores/bidding.js')
  const {api}=await server.ssrLoadModule('/src/core/services/api.js')
  setActivePinia(createPinia())
  const user=useUserStore();user.uid='student';user.isSignedIn=true;user.onboarded=true;user.balance=30
  const planner=usePlannerStore();planner.plans=[{id:'plan-a',tracks:[],currentSem:'Y1S1',semesters:[{id:'Y1S1',modules:[]},{id:'Y1S2',modules:['IS216','IS111']}]}];planner.activePlanId='plan-a';planner.online=true
  api.round=async()=>({term:'2026-27_T1',availableTerms:['2026-27_T1'],round:null,closesAt:null,configured:false})
  const a={id:'2026-27_T1:IS216:G11',module:'IS216',section:'G11',sessions:[{day:3,start:'12:00',end:'13:30',slot:1},{day:4,start:'12:00',end:'13:30',slot:1}],day:3,slot:1,exam:'No final exam'}
  const b={id:'2026-27_T1:IS111:G1',module:'IS111',section:'G1',sessions:[{day:4,start:'13:00',end:'14:00',slot:1}],day:4,slot:1,exam:'No final exam'}
  const c={...b,id:'2026-27_T1:IS111:G2',section:'G2',sessions:[{day:4,start:'13:30',end:'15:00',slot:1}]}
  api.sections=async()=>[a,b,c];api.bidHistory=async()=>[];api.weightage=async()=>[];api.cart=async()=>({items:[]})
  let saved
  api.saveCart=async data=>{saved=data;return {cart:data}}
  const bidding=useBiddingStore();await bidding.load()
  assert.equal(bidding.roundInfo.closesAt,null,'no fabricated future deadline')
  assert.equal(bidding.bids.IS216,10)
  assert.equal(bidding.clashes.has(a.id),true,'second weekly meeting clashes')
  assert.equal(await bidding.save(),false)
  assert.equal(saved,undefined)
  bidding.swapSection('IS111',c.id)
  assert.equal(bidding.clashes.size,0,'back-to-back classes do not clash')
  bidding.setBid('IS111',25)
  assert.equal(await bidding.save(),false,'budget checked before saving')
  bidding.setBid('IS111',12)
  assert.equal(await bidding.save(),true)
  assert.equal(saved.term,'2026-27_T1')
  assert.equal(saved.items.find(item=>item.module==='IS111').sectionId,c.id)
  assert.equal(bidding.slotLabel(a),'Thursday 12:00-13:30 · Friday 12:00-13:30')
 } finally {await server.close()}
})
