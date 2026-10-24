import test from 'node:test'
import assert from 'node:assert/strict'
import Plan from '../planning/models/Plan.js'
import BidCart from './models/BidCart.js'
import { getCart, saveCart, dropCartItem } from './bidding.controller.js'
test('cart read, write and delete reject a plan owned by another student',async()=>{
 const exists=Plan.exists,find=BidCart.findOne,update=BidCart.updateOne
 Plan.exists=async filter=>{assert.equal(filter.user,'student-a');return null}
 BidCart.findOne=async()=>null
 BidCart.updateOne=async()=>{}
 try {
  const req={user:{_id:'student-a'},query:{planId:'a'.repeat(24),term:'2026-27_T1'},body:{planId:'a'.repeat(24),term:'2026-27_T1',items:[]},params:{code:'IS216'}}
  const res={json:()=>{},status:()=>({end:()=>{}})}
  for(const handler of [getCart,saveCart,dropCartItem]) await assert.rejects(handler(req,res),error=>error.status===404)
 }finally {Plan.exists=exists;BidCart.findOne=find;BidCart.updateOne=update}
})
