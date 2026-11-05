import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { leaveParty } from './parties.controller.js'
import Notification from '../notifications/model/notification.js'

test('leaving transfers ownership to the first remaining member and deletes only an empty room', async () => {
  const insertMany = Notification.insertMany
  const [owner, next, last] = [1, 2, 3].map(n => new mongoose.Types.ObjectId(String(n).padStart(24, '0')))
  try {
    for (const locked of [false, true]) {
      const notices = []
      Notification.insertMany = async docs => { notices.push(...docs) }
      let saved = 0, deleted = 0
      const party = { _id: 'room', name: 'Friends', owner, members: [owner, next, last], votes: [{ user: owner, sectionIds: ['G1'] }, { user: next, sectionIds: ['G1'] }], memberSections: [{ user: owner, sectionId: 'G1' }], locked, lockedSection: locked ? 'G1' : null, save: async () => { saved++ }, deleteOne: async () => { deleted++ } }
      const res = { status: code => { assert.equal(code, 204); return { end() {} } } }
      await leaveParty({ party, user: { _id: owner, name: 'Owner' } }, res)
      assert.ok(party.owner.equals(next))
      assert.deepEqual(party.members, [next, last])
      assert.equal(party.votes.length, 1)
      assert.deepEqual(party.memberSections, [])
      assert.equal(party.locked, locked, 'the new owner inherits the existing lock and can unlock it')
      assert.equal(saved, 1); assert.equal(deleted, 0)
      assert.ok(notices.some(n => n.type === 'party_owner_changed' && n.user.equals(next)))

      party.members = [next]; party.votes = []; notices.length = 0
      await leaveParty({ party, user: { _id: next, name: 'Last member' } }, res)
      assert.equal(deleted, 1)
      assert.equal(saved, 1)
      assert.equal(notices.length, 0)
    }
  } finally { Notification.insertMany = insertMany }
})
