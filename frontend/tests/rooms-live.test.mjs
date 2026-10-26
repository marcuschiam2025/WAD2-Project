import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('rooms create, join and reload from the backend, retain state on failure and ignore stale account responses',async()=>{
 globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}}
 const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'})
 try {
  const {useUserStore}=await server.ssrLoadModule('/src/core/stores/user.js')
  const {useRoomsStore}=await server.ssrLoadModule('/src/core/stores/rooms.js')
  const {api}=await server.ssrLoadModule('/src/core/services/api.js')
  setActivePinia(createPinia())
  const user=useUserStore();user.uid='firebase-a';user.isSignedIn=true;user.profile={_id:'mongo-a',email:'a@smu.edu.sg',displayName:'Student A'}
  const party={_id:'party-a',name:'IS216 friends',module:'IS216',inviteCode:'AB12',owner:'mongo-a',maxMembers:6,members:[{_id:'mongo-a',name:'Student A',email:'a@smu.edu.sg'},{_id:'mongo-b',name:'Student B',email:'b@smu.edu.sg'}],votes:[]}
  api.rooms=async()=>[party]
  const rooms=useRoomsStore()
  await rooms.load()
  assert.equal(rooms.rooms[0].id,'party-a')
  assert.equal(rooms.rooms[0].inviteCode,'AB12')
  assert.equal(rooms.rooms[0].ownerId,'me')
  assert.deepEqual([...rooms.rooms[0].members],['me','mongo-b'])
  assert.equal(rooms.person('mongo-b').name,'Student B')
  // A room is created for the term BOSS is bidding for
  api.round=async()=>({term:'2026-27_T2'})
  api.createRoom=async payload=>{assert.equal(payload.name,'New room');assert.equal(payload.memberEmails,undefined);assert.deepEqual(Object.keys(payload).sort(),['module','name','termKey']);assert.equal(payload.termKey,'2026-27_T2');return {party:{...party,_id:'party-new',name:payload.name,termKey:payload.termKey},blocked:[]}}
  assert.equal(await rooms.createRoom({name:'New room',module:'IS216',maxMembers:4}),'party-new')
  assert.equal(rooms.getRoom('party-new').term,'2026-27_T2')
  assert.equal(rooms.rooms.length,2)
  api.joinRoom=async code=>{assert.equal(code,'AB12');return party}
  assert.equal(await rooms.joinRoom(' ab12 '),'party-a')
  assert.equal(rooms.rooms.length,2)
  api.joinRoom=async()=>{throw new Error('This party is full')}
  await assert.rejects(rooms.joinRoom('AB12'),/full/)
  assert.equal(rooms.rooms.length,2)
  let resolve
  api.rooms=()=>new Promise(r=>{resolve=r})
  const pending=rooms.load()
  user.uid='firebase-b'
  resolve([party]);await pending
  assert.equal(rooms.rooms.length,0)
  assert.equal(rooms.online,false)
 } finally {await server.close()}
})
