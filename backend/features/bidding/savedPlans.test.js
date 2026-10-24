import test from 'node:test'
import assert from 'node:assert/strict'
import BidCart from './models/BidCart.js'
import Section from './models/Section.js'
import * as bidding from './bidding.controller.js'

test('saved plans contain only the owner’s persisted carts and identify missing catalogue sections', async () => {
  const find = BidCart.find, sectionFind = Section.collection.find
  BidCart.find = filter => {
    assert.equal(filter.user,'student-a')
    return {sort:()=>({populate:()=>({lean:async()=>[
      {_id:'cart-a',plan:{_id:'plan-a',name:'My plan',user:'student-a'},term:'2026-27_T1',items:[{module:'IS216',sectionId:'2026-27_T1:IS216:G11',amount:12},{module:'IS444',sectionId:'gone',amount:10}]},
      {_id:'cart-b',plan:{_id:'plan-b',user:'other'},term:'2026-27_T1',items:[]},
      {_id:'orphan',plan:null,term:'2026-27_T1',items:[]},
    ]})})}
  }
  Section.collection.find = () => ({toArray:async()=>[{moduleCode:'IS216',termKey:'2026-27_T1',sectionCode:'G11',classSlots:[{day:'THU',start:'12:00',end:'13:30'},{day:'FRI',start:'12:00',end:'13:30'}]}]})
  try {
    let result
    await bidding.listSavedPlans({user:{_id:'student-a'},query:{term:'2026-27_T1'}},{json:value=>{result=value}})
    assert.equal(result.length,1)
    assert.equal(result[0].planId,'plan-a')
    assert.equal(result[0].allocated,22)
    assert.equal(result[0].items[0].section.sessions.length,2)
    assert.deepEqual(result[0].missingModules,['IS444'])
  } finally {BidCart.find=find;Section.collection.find=sectionFind}
})
