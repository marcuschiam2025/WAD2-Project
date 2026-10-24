import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import * as controller from './parties.controller.js'
import Party from './models/Party.js'
import Plan from '../planning/models/Plan.js'
import Module from '../planning/models/Module.js'
import BidCart from '../bidding/models/BidCart.js'
import Section from '../bidding/models/Section.js'

test('handoff only previews a current confirmed section for a member-owned plan and matching term', async () => {
  assert.equal(typeof controller.prepareHandoff, 'function', 'validated handoff endpoint is required')
  const me = new mongoose.Types.ObjectId(), outsider = new mongoose.Types.ObjectId(), id = '2026-27_T1:IS216:G1'
  const party = { _id: new mongoose.Types.ObjectId(), term: '2026-27_T1', module: 'IS216', members: [me], votes: [{ user: me, sectionIds: [id] }], finalisedSection: id }
  const original = { party: Party.findById, plan: Plan.exists, module: Module.findById, cart: BidCart.findOne, sections: Section.collection.find }
  Party.findById = async () => party
  Plan.exists = async filter => { assert.equal(String(filter.user), String(me)); return true }
  Module.findById = () => ({ lean: async () => ({ _id: 'IS216', prerequisites: [] }) })
  BidCart.findOne = () => ({ lean: async () => null })
  Section.collection.find = () => ({ toArray: async () => [{ moduleCode: 'IS216', termKey: party.term, sectionCode: 'G1', classSlots: [{ day: 'MON', start: '08:15', end: '09:45' }] }] })
  const req = { user: { _id: me, completedModules: [] }, params: { id: String(party._id) }, body: { planId: String(new mongoose.Types.ObjectId()), term: party.term, sectionId: id } }
  let result; const res = { json(data) { result = data } }
  try {
    await controller.prepareHandoff(req, res)
    assert.equal(result.section.id, id)
    await assert.rejects(controller.prepareHandoff({ ...req, user: { _id: outsider } }, res), { status: 403 })
    await assert.rejects(controller.prepareHandoff({ ...req, body: { ...req.body, term: '2026-27_T2' } }, res), { status: 409 })
    Plan.exists = async () => false
    await assert.rejects(controller.prepareHandoff(req, res), { status: 404 })
    Plan.exists = async () => true
    party.finalisedSection = null
    await assert.rejects(controller.prepareHandoff(req, res), { status: 409 })
  } finally { Party.findById = original.party; Plan.exists = original.plan; Module.findById = original.module; BidCart.findOne = original.cart; Section.collection.find = original.sections }
})
