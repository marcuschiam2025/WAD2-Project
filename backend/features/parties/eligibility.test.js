import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { createParty, getParty, joinParty } from './parties.controller.js'
import Party from './models/Party.js'
import Module from '../planning/models/Module.js'
import Section from '../bidding/models/Section.js'
import Notification from '../notifications/model/notification.js'

const userId = new mongoose.Types.ObjectId('0'.repeat(23) + '1')
const student = (completedModules = []) => ({ _id: userId, name: 'A', completedModules, exempted: [] })
const response = () => ({ status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
const body = { name: 'Friends', module: 'IS216', termKey: '2026-27_T2' }

// Stubs the module lookups so no database is needed; `done` is what Module.find returns for rule counting
async function withCatalogue(mod, done, run) {
  const original = { findById: Module.findById, find: Module.find, exists: Party.exists, save: Party.prototype.save }
  let saved = 0
  Module.findById = () => ({ lean: async () => mod })
  Module.find = () => ({ select: () => ({ lean: async () => done }) })
  Party.exists = async () => false
  Party.prototype.save = async function () { saved++ }
  try { return await run(() => saved) } finally {
    Module.findById = original.findById; Module.find = original.find; Party.exists = original.exists; Party.prototype.save = original.save
  }
}

test('a room cannot be created for a module that is not in the catalogue', async () => {
  await withCatalogue(null, [], async saved => {
    await assert.rejects(createParty({ body, user: student() }, response()), { status: 404 })
    assert.equal(saved(), 0)
  })
})
test('the creator has to meet the prerequisites too', async () => {
  await withCatalogue({ _id: 'IS216', prerequisites: [['IS111', 'CS101']] }, [], async saved => {
    const res = response()
    await createParty({ body, user: student() }, res)
    assert.equal(res.code, 403); assert.deepEqual(res.body.missing, ['IS111 or CS101']); assert.equal(saved(), 0)
    const ok = response()
    await createParty({ body, user: student(['CS101']) }, ok)
    assert.equal(ok.code, 201); assert.equal(saved(), 1)
  })
})
test('joining refuses an unknown module and enforces course-count rules', async () => {
  const findOne = Party.findOne, insertMany = Notification.insertMany
  const party = { name: 'Friends', module: 'IS483', termKey: '2026-27_T2', members: [], banned: [], maxMembers: 5, locked: false, save: async () => {} }
  Party.findOne = async () => party
  Notification.insertMany = async () => {}
  const req = { body: { inviteCode: 'ABC234' }, user: student(['IS111', 'IS112']) }
  try {
    await withCatalogue(null, [], () => assert.rejects(joinParty(req, response()), { status: 404 }))
    const rule = { _id: 'IS483', prerequisiteRules: [{ countFrom: 'TRACK', n: 2 }] }
    const oneTrack = [{ _id: 'IS111', categories: ['IS_TRACK'] }, { _id: 'IS112', categories: ['IS'] }]
    await withCatalogue(rule, oneTrack, async () => {
      const res = response()
      await joinParty(req, res)
      assert.equal(res.code, 403); assert.deepEqual(res.body.missing, ['2 track courses before this one']); assert.equal(party.members.length, 0)
    })
    await withCatalogue(rule, [oneTrack[0], { _id: 'IS112', categories: ['IS_TRACK'] }], async () => {
      await joinParty(req, response())
      assert.equal(party.members.length, 1)
    })
  } finally { Party.findOne = findOne; Notification.insertMany = insertMany }
})
test('a room is not ready while its only votes are for sections no longer on offer', async () => {
  const find = Section.collection.find
  Section.collection.find = () => ({ toArray: async () => [] })
  try {
    const party = { _id: 'r', module: 'IS216', termKey: '2026-27_T2', members: [userId], votes: [{ user: userId, sectionIds: ['IS216-OLD'] }], populate: async () => {}, toJSON() { return { _id: 'r' } } }
    const res = response()
    await getParty({ party }, res)
    assert.equal(res.body.summary.allVoted, false); assert.equal(res.body.summary.status, 'voting'); assert.equal(res.body.summary.votedCount, 0)
  } finally { Section.collection.find = find }
})

test('a module finished, exempted or in progress cannot get a new room or be joined', async () => {
  const findOne = Party.findOne
  const inProgress = { ...student(), currentSem: 'Y2S1', takenBySem: { Y1S2: ['IS111'], Y2S1: ['IS216'], Y2S2: ['IS442'] } }
  const cases = [
    { ...student(['IS216']) },
    { ...student(), exempted: ['IS216'] },
    inProgress,
    { ...student(), currentSem: 'Y2S1', takenBySem: { Y1S2: ['CS412 → IS216'] } },
  ]
  try {
    await withCatalogue({ _id: 'IS216', prerequisites: [] }, [], async saved => {
      for (const user of cases) {
        await assert.rejects(createParty({ body, user }, response()), { status: 409 })
        const party = { name: 'Friends', module: 'IS216', termKey: '2026-27_T2', members: [], banned: [], maxMembers: 5, locked: false, save: async () => {} }
        Party.findOne = async () => party
        await assert.rejects(joinParty({ body: { inviteCode: 'ABC234' }, user }, response()), { status: 409 })
        assert.equal(party.members.length, 0)
      }
      assert.equal(saved(), 0)
      // A module only planned for a later semester is exactly what rooms are for
      const res = response()
      await createParty({ body: { ...body, module: 'IS442' }, user: inProgress }, res)
      assert.equal(res.code, 201)
    })
  } finally { Party.findOne = findOne }
})
test('someone already in a room can still open it after taking the module', async () => {
  const findOne = Party.findOne
  const party = { module: 'IS216', members: [userId], banned: [] }
  Party.findOne = async () => party
  try {
    const res = response()
    await joinParty({ body: { inviteCode: 'ABC234' }, user: student(['IS216']) }, res)
    assert.equal(res.body, party)
  } finally { Party.findOne = findOne }
})

test('during Rounds 2 and 2A a current-semester module can get a room, but only for that semester\'s term', async () => {
  const january = { ...student(['IS111']), intakeYear: 2025, currentSem: 'Y2S2', takenBySem: { Y1S2: ['IS111'], Y2S2: ['IS442'] } }
  await withCatalogue({ _id: 'IS442', prerequisites: [] }, [], async () => {
    const res = response()
    await createParty({ body: { ...body, module: 'IS442', termKey: '2026-27_T2' }, user: january }, res)
    assert.equal(res.code, 201, 'still bidding for this term')
    await assert.rejects(createParty({ body: { ...body, module: 'IS442', termKey: '2027-28_T1' }, user: january }, response()), { status: 409 })
    await assert.rejects(createParty({ body: { ...body, module: 'IS111', termKey: '2026-27_T2' }, user: january }, response()), { status: 409 })
  })
})
