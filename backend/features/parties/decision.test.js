import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { decisionSummary } from './utils/decision.js'
import { lockParty, unlockParty } from './parties.controller.js'
import Party from './models/Party.js'
import Section from '../bidding/models/Section.js'
import Notification from '../notifications/model/notification.js'

test('decision summaries report the persisted room lock independently of changing vote leaders or catalogue entries', () => {
  const party = { members: ['a', 'b'], votes: [{ user: 'a', sectionIds: ['G1'] }, { user: 'b', sectionIds: ['G1'] }], locked: true, lockedSection: 'G1' }
  for (const valid of [['G1', 'G2'], []]) {
    const summary = decisionSummary(party, valid)
    assert.equal(summary.status, 'locked')
    assert.equal(summary.locked, true)
    assert.equal(summary.lockedSection, 'G1')
    assert.equal(summary.finalisedSection, 'G1', 'keep the existing response field as an alias')
  }
  party.members = ['a']
  assert.equal(decisionSummary(party, ['G1']).lockedSection, 'G1', 'leaving does not silently unlock the room')
  party.locked = false
  party.finalisedSection = 'G1'
  const unlocked = decisionSummary(party, ['G1'])
  assert.equal(unlocked.status, 'ready')
  assert.equal(unlocked.lockedSection, null)
  assert.equal(unlocked.finalisedSection, null, 'stale legacy or locked-section fields must not imply a live lock')
})

test('lock, read decision and unlock responses agree with the saved Party fields', async () => {
  const find = Section.collection.find, insertMany = Notification.insertMany
  const owner = new mongoose.Types.ObjectId(), member = new mongoose.Types.ObjectId()
  const sectionId = 'IS216-G1'
  Section.collection.find = () => ({ toArray: async () => [{ sectionId, module: 'IS216', section: 'G1', term: '2026-27_T2', meetings: [] }] })
  Notification.insertMany = async () => []
  const party = new Party({ name: 'Friends', module: 'IS216', termKey: '2026-27_T2', owner, members: [owner, member], votes: [{ user: owner, sectionIds: [sectionId] }, { user: member, sectionIds: [sectionId] }] })
  let saves = 0, response
  party.save = async () => { saves++ }
  const req = { party, user: { _id: owner }, body: { sectionId } }, res = { json: value => { response = value } }
  try {
    await lockParty(req, res)
    assert.equal(party.locked, true)
    assert.equal(response.status, 'locked')
    assert.equal(response.lockedSection, party.lockedSection)
    assert.equal(response.lockedSection, sectionId)
    assert.equal(response.finalisedSection, sectionId)
    await unlockParty(req, res)
    assert.equal(party.locked, false)
    assert.equal(response.status, 'ready')
    assert.equal(response.locked, false)
    assert.equal(response.lockedSection, null)
    assert.equal(response.finalisedSection, null)
    assert.equal(saves, 2)
    party.votes = []
    await assert.rejects(lockParty(req, res), error => error.status === 409)
    assert.equal(saves, 2, 'locking must still require every member to vote')
  } finally { Section.collection.find = find; Notification.insertMany = insertMany }
})
