import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import router from './parties.routes.js'
import { transferOwner } from './parties.controller.js'
import Notification from '../notifications/model/notification.js'

const [owner, next, outsider] = [1, 2, 3].map(n => new mongoose.Types.ObjectId(String(n).padStart(24, '0')))
const room = () => { const party = { _id: 'room', name: 'Friends', owner, members: [owner, next], saved: 0, save: async () => { party.saved++ } }; return party }
const request = (party, userId) => ({ party, body: { userId }, user: { _id: owner, name: 'Owner' } })
const response = () => ({ json(body) { this.body = body; return this } })

test('only the owner can reach the handover route', () => {
  const route = router.stack.find(layer => layer.route?.path === '/:id/owner' && layer.route.methods.put)?.route
  assert.deepEqual(route?.stack.map(layer => layer.name), ['loadParty', 'requireOwner', 'transferOwner'])
})
test('the owner can hand the role to a member, who is told', async () => {
  const insertMany = Notification.insertMany, notices = []
  Notification.insertMany = async docs => { notices.push(...docs) }
  try {
    const party = room(), res = response()
    await transferOwner(request(party, String(next)), res)
    assert.ok(party.owner.equals(next)); assert.equal(party.saved, 1); assert.equal(res.body, party)
    assert.deepEqual(party.members, [owner, next], 'nobody joins or leaves')
    assert.equal(notices.length, 1); assert.ok(notices[0].user.equals(next)); assert.equal(notices[0].type, 'party_owner_changed')
  } finally { Notification.insertMany = insertMany }
})
test('the role cannot go to a non-member, the current owner or a bad id', async () => {
  for (const userId of [String(outsider), String(owner), 'not-an-id', undefined, { $ne: null }]) {
    const party = room()
    await assert.rejects(transferOwner(request(party, userId), response()), { status: 400 })
    assert.ok(party.owner.equals(owner)); assert.equal(party.saved, 0)
  }
})
