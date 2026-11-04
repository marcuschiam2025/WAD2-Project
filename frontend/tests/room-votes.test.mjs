import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {createPinia,setActivePinia} from 'pinia'

test('room ballots reload confirmed picks, preserve them on save failure and discard responses from an old account',async()=>{
 globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}}
 const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'})
 try {
  const {useUserStore}=await server.ssrLoadModule('/src/core/stores/user.js')
  const {useRoomsStore}=await server.ssrLoadModule('/src/core/stores/rooms.js')
  const {api}=await server.ssrLoadModule('/src/core/services/api.js')
  setActivePinia(createPinia())
  const user=useUserStore();user.uid='a';user.isSignedIn=true;user.profile={_id:'a'}
  const rooms=useRoomsStore()
  let saved=[]
  // GET /parties/:id and GET /parties/:id/sections, which the store turns into the vote board
  const party=()=>({_id:'room-a',termKey:'2026-27_T2',owner:'a',members:[{_id:'a',name:'A'},{_id:'b',name:'B'}],votes:saved.length?[{user:{_id:'a',name:'A'},sectionIds:[...saved]}]:[],memberSections:[]})
  const sections=()=>[{section:{id:'section-a',section:'G1',module:'IS216'},voteCount:saved.length,voters:saved.length?[{_id:'a',name:'A'}]:[],goingFor:[]}]
  api.room=async()=>party()
  api.roomSections=async()=>sections()
  await rooms.loadVotes('room-a')
  assert.equal(rooms.voteBoards['room-a'].term,'2026-27_T2')
  assert.equal(rooms.voteBoards['room-a'].votedCount,0)
  api.vote=async(id,ids)=>{assert.equal(id,'room-a');saved=ids;return party().votes}
  assert.equal(await rooms.saveRoomVotes('room-a',['section-a']),true)
  assert.deepEqual([...rooms.voteBoards['room-a'].mySectionIds],['section-a'])
  assert.equal(rooms.voteBoards['room-a'].votedCount,1)
  assert.deepEqual([...rooms.voteBoards['room-a'].waitingIds],['b'])
  api.vote=async()=>{throw new Error('Network unavailable')}
  assert.equal(await rooms.saveRoomVotes('room-a',[]),false)
  assert.deepEqual([...rooms.voteBoards['room-a'].mySectionIds],['section-a'])
  assert.equal(rooms.voteErrors['room-a'],'Network unavailable')
  let finishRefresh
  api.room=()=>new Promise(r=>{finishRefresh=r})
  const refreshing=rooms.loadVotes('room-a')
  assert.equal(await rooms.saveRoomVotes('room-a',[]),false)
  assert.equal(rooms.voteLoading['room-a'],false,'failed save cannot leave an invalidated refresh stuck loading')
  finishRefresh(party());await refreshing
  let resolve
  api.room=()=>new Promise(r=>{resolve=r})
  const pending=rooms.loadVotes('room-a')
  user.uid='b';resolve(party());await pending
  assert.equal(rooms.voteBoards['room-a'],undefined)
 } finally {await server.close()}
})
