import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import Party from './models/Party.js'
import Section from '../bidding/models/Section.js'
import {getVotes,saveVotes} from './parties.controller.js'

test('room votes use shared sections, exclude former members and enforce module, term and membership in the write',async()=>{
 const me=new mongoose.Types.ObjectId(), friend=new mongoose.Types.ObjectId(), former=new mongoose.Types.ObjectId()
 const id='2026-27_T1:IS216:G11'
 const party={_id:new mongoose.Types.ObjectId(),term:'2026-27_T1',module:'IS216',members:[me,friend],votes:[{user:{_id:me,name:'Me'},sectionIds:[id]},{user:{_id:former,name:'Former member'},sectionIds:[id]}],populate:async()=>{}}
 const originals={find:Party.findById,update:Party.findOneAndUpdate,sections:Section.collection.find}
 Party.findById=async()=>party
 Section.collection.find=()=>({toArray:async()=>[{moduleCode:'IS216',termKey:'2026-27_T1',sectionCode:'G11',classSlots:[{day:'THU',start:'12:00',end:'13:30'},{day:'FRI',start:'12:00',end:'13:30'}]}]})
 let writes=0,result
 Party.findOneAndUpdate=async(filter,pipeline)=>{writes++;assert.equal(String(filter.members),String(me));assert.equal(pipeline[0].$set.term,'2026-27_T1');assert.ok(pipeline[0].$set.votes.$concatArrays);return party}
 const req={user:{_id:me},params:{id:String(party._id)},query:{term:'2026-27_T1'},body:{term:'2026-27_T1',sectionIds:[id]}}
 const res={json:data=>{result=data}}
 try {
  await getVotes(req,res)
  assert.equal(result.rows[0].section.sessions.length,2)
  assert.equal(result.rows[0].count,1)
  assert.equal(result.votedCount,1)
  assert.deepEqual(result.mySectionIds,[id])
  await saveVotes(req,res)
  assert.equal(writes,1)
  for(const sectionIds of ['not-array',[2],['2026-27_T1:IS111:G1']]) await assert.rejects(saveVotes({...req,body:{term:'2026-27_T1',sectionIds}},res),err=>err.status===400)
  await assert.rejects(saveVotes({...req,body:{term:'2026-27_T2',sectionIds:[id]}},res),err=>err.status===409)
  await assert.rejects(getVotes({...req,user:{_id:former}},res),err=>err.status===403)
  assert.equal(writes,1)
 }finally {Party.findById=originals.find;Party.findOneAndUpdate=originals.update;Section.collection.find=originals.sections}
})
