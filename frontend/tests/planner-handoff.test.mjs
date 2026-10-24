import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return {promise,resolve} }

test('semester edits save in order and survive reload; bidding excludes sample-only sections', async () => {
 globalThis.localStorage = {getItem:()=>null,setItem:()=>{},removeItem:()=>{}}
 const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'})
 try {
  const {useUserStore}=await server.ssrLoadModule('/src/core/stores/user.js')
  const {usePlannerStore}=await server.ssrLoadModule('/src/core/stores/planner.js')
  const {useBiddingStore}=await server.ssrLoadModule('/src/core/stores/bidding.js')
  const {useCatalogueStore}=await server.ssrLoadModule('/src/core/stores/catalogue.js')
  const {api}=await server.ssrLoadModule('/src/core/services/api.js')
  setActivePinia(createPinia())
  const user=useUserStore();user.uid='student';user.isSignedIn=true;user.onboarded=true
  user.profile.basket=['IS212','IS419']
  const planner=usePlannerStore()
  useCatalogueStore().load=async()=>{}
  let stored={_id:'plan-a',name:'Plan 1',tracks:[],currentSem:'Y2S1',semesters:[{id:'Y2S1',modules:[]},{id:'Y2S2',modules:[]}]}
  api.plans=async()=>[structuredClone(stored)]
  api.checkPlan=async()=>({})
  api.updateMe=async data=>data
  await planner.load()
  const writes=[]
  api.updatePlan=(_id,data)=>{const wait=deferred();writes.push({data:structuredClone(data),...wait});return wait.promise.then(()=>{stored={...stored,...data};return stored})}
  planner.placeModule('IS212','Y2S2')
  const saving=planner.savePlans()
  await Promise.resolve()
  planner.placeModule('IS419','Y2S2')
  await Promise.resolve()
  assert.equal(writes.length,1)
  writes[0].resolve()
  await Promise.resolve();await Promise.resolve();await Promise.resolve()
  assert.deepEqual(writes[1].data.semesters[1].modules,['IS212','IS419'])
  writes[1].resolve()
  await saving
  await planner.saveBasket()
  assert.deepEqual(user.profile.basket,[])
  await planner.reload()
  assert.deepEqual(planner.activePlan.semesters[1].modules,['IS212','IS419'])
  assert.equal(planner.plansSaving,false)
  const bidding=useBiddingStore()
  api.round=async()=>({term:'AY24/25 T2',round:'1A',closesAt:null})
  api.sections=async()=>[];api.cart=async()=>({items:[]})
  api.bidHistory=async()=>[];api.weightage=async()=>[]
  await bidding.load()
  assert.deepEqual(bidding.bookedSections,[], 'sample IS212 sections must not become live choices')
  assert.deepEqual(bidding.notOffered,['IS212','IS419'])
 } finally {await server.close()}
})
