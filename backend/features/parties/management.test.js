import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import Party from './models/Party.js'
import Section from '../bidding/models/Section.js'
import * as controller from './parties.controller.js'

test('confirmation requires owner, every member vote, a leading section and the displayed revision', async () => {
  const owner = new mongoose.Types.ObjectId(), friend = new mongoose.Types.ObjectId()
  const g1 = '2026-27_T1:IS216:G1', g2 = '2026-27_T1:IS216:G2'
  const party = { _id: new mongoose.Types.ObjectId(), owner, members: [owner, friend], module: 'IS216', term: '2026-27_T1', revision: 4, votes: [{ user: owner, sectionIds: [g1] }], save: async () => {} }
  const original = { find: Party.findById, update: Party.findOneAndUpdate, sections: Section.collection.find }
  Party.findById = async () => party
  Section.collection.find = () => ({ toArray: async () => ['G1','G2'].map(sectionCode => ({ moduleCode: 'IS216', termKey: party.term, sectionCode, classSlots: [{ day: 'MON', start: '08:15', end: '09:45' }] })) })
  const req = { user: { _id: owner }, params: { id: String(party._id) }, body: { sectionId: g1, revision: 4 } }
  const res = { json() {} }
  let writes = 0
  Party.findOneAndUpdate = async filter => { writes++; assert.equal(filter.revision, 4); assert.equal(String(filter.owner), String(owner)); return party }
  try {
    await assert.rejects(controller.finaliseSection(req, res), { status: 409 })
    party.votes.push({ user: friend, sectionIds: [g1] })
    await assert.rejects(controller.finaliseSection({ ...req, user: { _id: friend } }, res), { status: 403 })
    await assert.rejects(controller.finaliseSection({ ...req, body: { sectionId: g2, revision: 4 } }, res), { status: 400 })
    await assert.rejects(controller.finaliseSection({ ...req, body: { sectionId: g1 } }, res), { status: 400 })
    await controller.finaliseSection(req, res)
    assert.equal(writes, 1)
    Party.findOneAndUpdate = async () => null
    await assert.rejects(controller.finaliseSection(req, res), { status: 409 })
  } finally { Party.findById = original.find; Party.findOneAndUpdate = original.update; Section.collection.find = original.sections }
})

test('membership management cannot remove self or transfer to outsiders and guards concurrent changes', async () => {
  assert.equal(typeof controller.removeMember, 'function', 'persistent member removal is required')
  assert.equal(typeof controller.transferOwner, 'function', 'persistent ownership transfer is required')
  const owner = new mongoose.Types.ObjectId(), friend = new mongoose.Types.ObjectId(), outsider = new mongoose.Types.ObjectId()
  const party = { _id: new mongoose.Types.ObjectId(), owner, members: [owner, friend], votes: [], revision: 0, populate: async () => {} }
  const original = { find: Party.findById, update: Party.findOneAndUpdate }
  Party.findById = async () => party
  const req = { user: { _id: owner }, params: { id: String(party._id), memberId: String(friend) }, body: { revision: 0, userId: String(friend) } }
  let result, writes = 0
  const res = { json(data) { result = data } }
  Party.findOneAndUpdate = async (filter, update) => { writes++; assert.ok(filter.$or); assert.ok(update.$inc.revision); return party }
  try {
    await assert.rejects(controller.removeMember({ ...req, params: { ...req.params, memberId: String(owner) } }, res), { status: 400 })
    await assert.rejects(controller.removeMember({ ...req, user: { _id: friend } }, res), { status: 403 })
    await assert.rejects(controller.transferOwner({ ...req, body: { revision: 0, userId: String(outsider) } }, res), { status: 400 })
    await controller.removeMember(req, res)
    assert.ok(result); assert.equal(writes, 1)
    await controller.transferOwner(req, res)
    assert.equal(writes, 2)
    Party.findOneAndUpdate = async () => null
    await assert.rejects(controller.removeMember(req, res), { status: 409 })
  } finally { Party.findById = original.find; Party.findOneAndUpdate = original.update }
})
