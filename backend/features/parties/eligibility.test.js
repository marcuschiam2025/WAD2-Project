import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import Party from './models/Party.js'
import User from '../auth/models/User.js'
import Module from '../planning/models/Module.js'
import { createParty, joinParty } from './parties.controller.js'

const student = () => ({ _id: new mongoose.Types.ObjectId(), intakeYear: 2025, currentSem: 'Y2S1', completedModules: [], takenBySem: new Map([['Y2S1', ['IS113']], ['Y2S2', ['IS999']]]) })

test('joining uses the new termKey contract and counts current prerequisites only for a later term', async () => {
  const user = student()
  const party = { _id: new mongoose.Types.ObjectId(), module: 'IS216', termKey: '2026-27_T2', members: [new mongoose.Types.ObjectId()], banned: [], maxMembers: 6, save: async () => {} }
  const original = { find: Party.findOne, module: Module.findById }
  Party.findOne = async () => party
  Module.findById = () => ({ lean: async () => ({ prerequisites: [['IS113']] }) })
  let result, status
  const res = { json: value => { result = value }, status: value => { status = value; return res } }
  try {
    await joinParty({ user, body: { inviteCode: 'ABC123' } }, res)
    assert.equal(result, party)
    assert.ok(party.members.some(id => id.equals(user._id)))
    assert.deepEqual(user.completedModules, [], 'planning eligibility cannot mark current courses completed')
    party.members = []; party.termKey = '2026-27_T1'
    await joinParty({ user, body: { inviteCode: 'ABC123' } }, res)
    assert.equal(status, 403, 'same-term prerequisites still need to have been completed')
    assert.deepEqual(result.missing, ['IS113'])
    party.termKey = '2026-27_T2'; user.takenBySem = { Y2S1: [], Y2S2: ['IS113'] }
    await joinParty({ user, body: { inviteCode: 'ABC123' } }, res)
    assert.equal(status, 403, 'future planned courses do not count')
  } finally { Party.findOne = original.find; Module.findById = original.module }
})

test('creation keeps the group invitation flow and admits invitees taking the prerequisite now', async () => {
  const invitee = { ...student(), email: 'friend@smu.edu.sg', name: 'Friend' }
  const original = { users: User.find, exists: Party.exists, save: Party.prototype.save, module: Module.findById }
  User.find = async () => [invitee]
  Party.exists = async () => false
  Party.prototype.save = async function () { return this }
  Module.findById = () => ({ lean: async () => ({ prerequisites: [['IS113']] }) })
  let result
  try {
    const owner = new mongoose.Types.ObjectId()
    await createParty({ user: { _id: owner }, body: { name: 'Friends', module: 'IS216', termKey: '2026-27_T2', memberEmails: [invitee.email] } }, { status: () => ({ json: value => { result = value } }) })
    assert.deepEqual(result.blocked, [])
    assert.deepEqual(result.party.members.map(String), [String(owner), String(invitee._id)])
    assert.equal(result.party.termKey, '2026-27_T2')
    assert.deepEqual(invitee.completedModules, [])
  } finally { User.find = original.users; Party.exists = original.exists; Party.prototype.save = original.save; Module.findById = original.module }
})
