import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCartItems } from './cartValidation.js'
test('validates numeric bids, minimums, budget, arrays and duplicate modules before persistence',()=>{
 const valid=[{module:'IS216',sectionId:'2026-27_T1:IS216:G2',amount:10}]
 assert.equal(validateCartItems(valid,100),10)
 for(const items of [{},[...valid,...valid],[{...valid[0],amount:'10'}],[{...valid[0],amount:NaN}],[{...valid[0],amount:Infinity}],[{...valid[0],amount:9}],[{...valid[0],amount:101}]]) assert.throws(()=>validateCartItems(items,100))
})
