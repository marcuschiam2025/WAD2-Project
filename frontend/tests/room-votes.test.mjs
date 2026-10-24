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
  const user=useUserStore();user.uid='a';user.isSignedIn=true
  const rooms=useRoomsStore()
  let saved=[]
  const board=()=>({term:'2026-27_T2',rows:[{section:{id:'section-a'},count:saved.length,voters:[]}],mySectionIds:[...saved],memberCount:2,votedCount:saved.length})
  api.roomVotes=async()=>board()
  await rooms.loadVotes('room-a')
  api.vote=async(id,ids,term)=>{assert.equal(id,'room-a');assert.equal(term,'2026-27_T2');saved=ids;return {term,sectionIds:ids}}
  assert.equal(await rooms.saveRoomVotes('room-a',['section-a']),true)
  assert.deepEqual([...rooms.voteBoards['room-a'].mySectionIds],['section-a'])
  api.vote=async()=>{throw new Error('Network unavailable')}
  assert.equal(await rooms.saveRoomVotes('room-a',[]),false)
  assert.deepEqual([...rooms.voteBoards['room-a'].mySectionIds],['section-a'])
  assert.equal(rooms.voteErrors['room-a'],'Network unavailable')
  let finishRefresh
  api.roomVotes=()=>new Promise(r=>{finishRefresh=r})
  const refreshing=rooms.loadVotes('room-a')
  assert.equal(await rooms.saveRoomVotes('room-a',[]),false)
  assert.equal(rooms.voteLoading['room-a'],false,'failed save cannot leave an invalidated refresh stuck loading')
  finishRefresh(board());await refreshing
  let resolve
  api.roomVotes=()=>new Promise(r=>{resolve=r})
  const pending=rooms.loadVotes('room-a')
  user.uid='b';resolve(board());await pending
  assert.equal(rooms.voteBoards['room-a'],undefined)
 } finally {await server.close()}
})
