import test from 'node:test'
import assert from 'node:assert/strict'
import {createParty,joinParty} from './parties.controller.js'

test('room creation and joining reject malformed input before any database work',async()=>{
 for(const body of [{},{name:' ',module:'IS216'},{name:'Test',module:''},{name:'Test',module:{bad:true}}]) {
  await assert.rejects(createParty({body,user:{_id:'a'}},{}),error=>error.status===400)
 }
 for(const inviteCode of ['', '123456789','AB!2']) await assert.rejects(joinParty({body:{inviteCode},user:{_id:'a'}},{}),error=>error.status===400)
})

import mongoose from 'mongoose'
import Party from './models/Party.js'
import Module from '../planning/models/Module.js'

test('joining enforces capacity in the write and returns populated existing membership without duplication',async()=>{
 const owner=new mongoose.Types.ObjectId(), mine=new mongoose.Types.ObjectId()
 const party={_id:new mongoose.Types.ObjectId(),module:'IS216',members:[owner],banned:[],maxMembers:2,populate:async()=>{}}
 const original={findOne:Party.findOne,findOneAndUpdate:Party.findOneAndUpdate,findById:Module.findById}
 let result, writes=0
 Party.findOne=async()=>party
 Module.findById=()=>({lean:async()=>({prerequisites:[]})})
 Party.findOneAndUpdate=async(filter,update)=>{
  writes++
  assert.deepEqual(filter.$or[1].$expr,{$lt:[{$size:'$members'},'$maxMembers']})
  assert.equal(String(update.$addToSet.members),String(mine))
  return null // Another student took the final space before the atomic write.
 }
 const request={body:{inviteCode:' ab12 '},user:{_id:mine,completedModules:[]}}
 try {
  await assert.rejects(joinParty(request,{json:value=>{result=value}}),error=>error.status===409)
  party.members.push(mine)
  await joinParty(request,{json:value=>{result=value}})
  assert.equal(result,party)
  assert.equal(writes,1,'existing member does not join twice')
 } finally {Party.findOne=original.findOne;Party.findOneAndUpdate=original.findOneAndUpdate;Module.findById=original.findById}
})


test('creating a party uses only name and module; creator becomes admin and plans cannot be imported',async()=>{
 const original={exists:Party.exists,moduleExists:Module.exists,save:Party.prototype.save,populate:Party.prototype.populate}
 const creator=new mongoose.Types.ObjectId(), other=new mongoose.Types.ObjectId()
 Party.exists=async()=>false
 Module.exists=async()=>({_id:'IS216'})
 Party.prototype.save=async function(){return this}
 Party.prototype.populate=async function(){return this}
 let result
 try {
  await createParty({user:{_id:creator},body:{name:'My party',module:'IS216',owner:other,maxMembers:8,memberEmails:['other@smu.edu.sg'],importedPlans:[{plan:new mongoose.Types.ObjectId()}]}},{status:()=>({json:value=>{result=value}})})
  assert.equal(String(result.party.owner),String(creator))
  assert.deepEqual(result.party.members.map(String),[String(creator)])
  assert.equal(result.party.maxMembers,6)
  assert.equal(result.party.description,undefined)
  assert.equal(result.party.importedPlans?.length ?? 0,0)
 } finally {Party.exists=original.exists;Module.exists=original.moduleExists;Party.prototype.save=original.save;Party.prototype.populate=original.populate}
})
