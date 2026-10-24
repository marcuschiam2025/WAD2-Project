import test from 'node:test'
import assert from 'node:assert/strict'
import Plan from '../planning/models/Plan.js'
import BidCart from './models/BidCart.js'
import Section from './models/Section.js'
import { saveCart, validateCart, listSavedPlans } from './bidding.controller.js'

const section = { moduleCode: 'IS216', termKey: '2026-27_T2', sectionCode: 'G1', archived: true, classSlots: [{ day: 'MON', start: '09:00', end: '10:00' }] }
test('archived sections cannot be saved or validated as active bids but remain readable in saved carts', async () => {
  const original = { plan: Plan.exists, find: Section.collection.find, write: BidCart.findOneAndUpdate, carts: BidCart.find }
  Plan.exists = async () => true
  Section.collection.find = () => ({ toArray: async () => [section] })
  BidCart.findOneAndUpdate = () => assert.fail('Archived bid must not reach persistence')
  const id = '2026-27_T2:IS216:G1', planId = '012345678901234567890123'
  try {
    await assert.rejects(saveCart({ user: { _id: 'student', balance: 210 }, body: { planId, term: '2026-27_T2', items: [{ module: 'IS216', sectionId: id, amount: 10 }] } }, {}), { status: 409 })
    await assert.rejects(validateCart({ body: { sectionIds: [id] } }, {}), { status: 409 })
    BidCart.find = () => ({ sort: () => ({ populate: () => ({ lean: async () => [{ _id: 'cart', plan: { _id: planId, user: 'student', name: 'Plan' }, items: [{ module: 'IS216', sectionId: id, amount: 10 }] }] }) }) })
    let result
    await listSavedPlans({ user: { _id: 'student' }, query: { term: '2026-27_T2' } }, { json: value => { result = value } })
    assert.equal(result[0].items[0].section.id, id)
    assert.equal(result[0].items[0].section.archived, true)
    assert.deepEqual(result[0].missingModules, [])
  } finally { Plan.exists = original.plan; Section.collection.find = original.find; BidCart.findOneAndUpdate = original.write; BidCart.find = original.carts }
})
