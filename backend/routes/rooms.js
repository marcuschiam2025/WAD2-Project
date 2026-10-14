import { Router } from 'express'
import crypto from 'node:crypto'
import Room from '../models/Room.js'
import User from '../models/User.js'
import Module from '../models/Module.js'
import Section from '../models/Section.js'
import { httpError } from '../middleware/errorHandler.js'

const router = Router()

const MEMBER_FIELDS = 'name email'

async function missingPrereqs(user, moduleCode) {
  const mod = await Module.findOne({ code: moduleCode })
  return (mod?.prereqs ?? []).filter((p) => !user.completedModules.includes(p))
}

async function uniqueInviteCode() {
  for (;;) {
    const code = crypto.randomBytes(2).toString('hex').toUpperCase()
    if (!(await Room.exists({ inviteCode: code }))) return code
  }
}

const isMember = (room, user) => room.members.some((m) => (m._id ?? m).equals(user._id))
const isOwner = (room, user) => room.owner.equals(user._id)

async function findRoomForMember(req) {
  const room = await Room.findById(req.params.id)
  if (!room) throw httpError(404, 'Room not found')
  if (!isMember(room, req.user)) throw httpError(403, 'You are not a member of this room')
  return room
}

// GET /api/rooms — rooms I'm in
router.get('/', async (req, res) => {
  const rooms = await Room.find({ members: req.user._id })
    .select('name description module inviteCode maxMembers members updatedAt')
    .populate('members', MEMBER_FIELDS)
    .sort({ updatedAt: -1 })
  res.json(rooms)
})

// POST /api/rooms { name, description, module, maxMembers, memberEmails? }
// Invitees missing the module's prerequisites are returned in `blocked` instead of being added.
router.post('/', async (req, res) => {
  const { name, description, module, maxMembers, memberEmails = [] } = req.body
  const room = new Room({
    name,
    description,
    module,
    maxMembers,
    inviteCode: await uniqueInviteCode(),
    owner: req.user._id,
    members: [req.user._id],
  })

  const blocked = []
  const invitees = await User.find({ email: { $in: memberEmails.map((e) => String(e).toLowerCase()) } })
  for (const invitee of invitees) {
    if (room.members.length >= room.maxMembers) break
    const missing = await missingPrereqs(invitee, module)
    if (missing.length) blocked.push({ email: invitee.email, name: invitee.name, missing })
    else if (!isMember(room, invitee)) room.members.push(invitee._id)
  }

  await room.save()
  res.status(201).json({ room, blocked })
})

// POST /api/rooms/join { inviteCode }
router.post('/join', async (req, res) => {
  const room = await Room.findOne({ inviteCode: String(req.body.inviteCode ?? '').toUpperCase() })
  if (!room) throw httpError(404, 'No room found for that invite code')
  if (isMember(room, req.user)) return res.json(room)
  if (room.banned.some((id) => id.equals(req.user._id))) throw httpError(403, 'You cannot join this room')
  if (room.members.length >= room.maxMembers) throw httpError(409, 'This room is full')

  const missing = await missingPrereqs(req.user, room.module)
  if (missing.length) {
    return res.status(403).json({ error: `Missing prerequisite for ${room.module}`, missing })
  }

  room.members.push(req.user._id)
  await room.save()
  res.json(room)
})

// GET /api/rooms/:id
router.get('/:id', async (req, res) => {
  const room = await findRoomForMember(req)
  await room.populate([
    { path: 'members', select: MEMBER_FIELDS },
    { path: 'importedPlans.plan' },
    { path: 'comments.user', select: MEMBER_FIELDS },
  ])
  res.json(room)
})

// GET /api/rooms/:id/updates?since=<ISO date> — short-polling endpoint; 204 when nothing changed
router.get('/:id/updates', async (req, res) => {
  const room = await findRoomForMember(req)
  const since = new Date(req.query.since ?? 0)
  if (room.updatedAt <= since) return res.status(204).end()
  await room.populate('members', MEMBER_FIELDS)
  res.json(room)
})

// DELETE /api/rooms/:id/members/me — leave; the room is deleted when the last member leaves
router.delete('/:id/members/me', async (req, res) => {
  const room = await findRoomForMember(req)
  room.members = room.members.filter((m) => !m.equals(req.user._id))
  room.votes = room.votes.filter((v) => !v.user.equals(req.user._id))
  if (!room.members.length) await room.deleteOne()
  else {
    if (isOwner(room, req.user)) room.owner = room.members[0]
    await room.save()
  }
  res.status(204).end()
})

// POST /api/rooms/:id/ban { userId } — owner removes a member and blocks them from rejoining
router.post('/:id/ban', async (req, res) => {
  const room = await findRoomForMember(req)
  if (!isOwner(room, req.user)) throw httpError(403, 'Only the room owner can ban members')
  room.members = room.members.filter((m) => String(m) !== req.body.userId)
  if (!room.banned.some((id) => String(id) === req.body.userId)) room.banned.push(req.body.userId)
  await room.save()
  res.json(room)
})

// PUT /api/rooms/:id/votes { sectionIds } — my preferred slots for the room's module
router.put('/:id/votes', async (req, res) => {
  const room = await findRoomForMember(req)
  const sectionIds = [...new Set(req.body.sectionIds ?? [])]
  const valid = await Section.countDocuments({ sectionId: { $in: sectionIds }, module: room.module })
  if (valid !== sectionIds.length) throw httpError(400, `All sections must belong to ${room.module}`)

  const mine = room.votes.find((v) => v.user.equals(req.user._id))
  if (mine) mine.sectionIds = sectionIds
  else room.votes.push({ user: req.user._id, sectionIds })
  await room.save()
  res.json(room.votes)
})

// GET /api/rooms/:id/votes — per-section counts and voters
router.get('/:id/votes', async (req, res) => {
  const room = await findRoomForMember(req)
  await room.populate('votes.user', MEMBER_FIELDS)
  const sections = await Section.find({ module: room.module }).sort({ day: 1, slot: 1 })
  res.json(
    sections.map((s) => {
      const voters = room.votes.filter((v) => v.sectionIds.includes(s.sectionId)).map((v) => v.user)
      return { section: s, count: voters.length, voters, finalised: room.finalisedSection === s.sectionId }
    }),
  )
})

// POST /api/rooms/:id/finalise { sectionId } — owner locks in the agreed slot
router.post('/:id/finalise', async (req, res) => {
  const room = await findRoomForMember(req)
  if (!isOwner(room, req.user)) throw httpError(403, 'Only the room owner can finalise a slot')
  room.finalisedSection = req.body.sectionId
  await room.save()
  res.json(room)
})

// PUT /api/rooms/:id/plans { planIds } — share my What-If plans with the room
router.put('/:id/plans', async (req, res) => {
  const room = await findRoomForMember(req)
  room.importedPlans = [
    ...room.importedPlans.filter((p) => !p.user.equals(req.user._id)),
    ...(req.body.planIds ?? []).map((plan) => ({ user: req.user._id, plan })),
  ]
  await room.save()
  res.json(room.importedPlans)
})

// POST /api/rooms/:id/comments { module, text }
router.post('/:id/comments', async (req, res) => {
  const room = await findRoomForMember(req)
  room.comments.push({ user: req.user._id, module: req.body.module, text: req.body.text })
  await room.save()
  res.status(201).json(room.comments.at(-1))
})

export default router
