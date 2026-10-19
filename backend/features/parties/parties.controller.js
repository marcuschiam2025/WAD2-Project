import crypto from 'node:crypto'
import Party from './models/Party.js'
import User from '../auth/models/User.js'
import Module from '../planning/models/Module.js'
import Section from '../bidding/models/Section.js'
import { httpError } from '../../middleware/errorHandler.js'

const MEMBER_FIELDS = 'name email'

async function missingPrereqs(user, moduleCode) {
  const mod = await Module.findOne({ code: moduleCode })
  return (mod?.prereqs ?? []).filter((p) => !user.completedModules.includes(p))
}

async function uniqueInviteCode() {
  for (;;) {
    const code = crypto.randomBytes(2).toString('hex').toUpperCase()
    if (!(await Party.exists({ inviteCode: code }))) return code
  }
}

const isMember = (party, user) => party.members.some((m) => (m._id ?? m).equals(user._id))
const isOwner = (party, user) => party.owner.equals(user._id)

async function findPartyForMember(req) {
  const party = await Party.findById(req.params.id)
  if (!party) throw httpError(404, 'Party not found')
  if (!isMember(party, req.user)) throw httpError(403, 'You are not a member of this party')
  return party
}

// GET /api/parties — parties I'm in
export async function listParties(req, res) {
  const parties = await Party.find({ members: req.user._id })
    .select('name description module inviteCode maxMembers members updatedAt')
    .populate('members', MEMBER_FIELDS)
    .sort({ updatedAt: -1 })
  res.json(parties)
}

// POST /api/parties { name, description, module, maxMembers, memberEmails? }
// Invitees missing the module's prerequisites are returned in `blocked` instead of being added.
export async function createParty(req, res) {
  const { name, description, module, maxMembers, memberEmails = [] } = req.body
  const party = new Party({
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
    if (party.members.length >= party.maxMembers) break
    const missing = await missingPrereqs(invitee, module)
    if (missing.length) blocked.push({ email: invitee.email, name: invitee.name, missing })
    else if (!isMember(party, invitee)) party.members.push(invitee._id)
  }

  await party.save()
  res.status(201).json({ party, blocked })
}

// POST /api/parties/join { inviteCode }
export async function joinParty(req, res) {
  const party = await Party.findOne({ inviteCode: String(req.body.inviteCode ?? '').toUpperCase() })
  if (!party) throw httpError(404, 'No party found for that invite code')
  if (isMember(party, req.user)) return res.json(party)
  if (party.banned.some((id) => id.equals(req.user._id))) throw httpError(403, 'You cannot join this party')
  if (party.members.length >= party.maxMembers) throw httpError(409, 'This party is full')

  const missing = await missingPrereqs(req.user, party.module)
  if (missing.length) {
    return res.status(403).json({ error: `Missing prerequisite for ${party.module}`, missing })
  }

  party.members.push(req.user._id)
  await party.save()
  res.json(party)
}

// GET /api/parties/:id
export async function getParty(req, res) {
  const party = await findPartyForMember(req)
  await party.populate([
    { path: 'members', select: MEMBER_FIELDS },
    { path: 'importedPlans.plan' },
    { path: 'comments.user', select: MEMBER_FIELDS },
  ])
  res.json(party)
}

// GET /api/parties/:id/updates?since=<ISO date> — short-polling endpoint; 204 when nothing changed
export async function getUpdates(req, res) {
  const party = await findPartyForMember(req)
  const since = new Date(req.query.since ?? 0)
  if (party.updatedAt <= since) return res.status(204).end()
  await party.populate('members', MEMBER_FIELDS)
  res.json(party)
}

// DELETE /api/parties/:id/members/me — leave; the party is deleted when the last member leaves
export async function leaveParty(req, res) {
  const party = await findPartyForMember(req)
  party.members = party.members.filter((m) => !m.equals(req.user._id))
  party.votes = party.votes.filter((v) => !v.user.equals(req.user._id))
  if (!party.members.length) await party.deleteOne()
  else {
    if (isOwner(party, req.user)) party.owner = party.members[0]
    await party.save()
  }
  res.status(204).end()
}

// POST /api/parties/:id/ban { userId } — owner removes a member and blocks them from rejoining
export async function banMember(req, res) {
  const party = await findPartyForMember(req)
  if (!isOwner(party, req.user)) throw httpError(403, 'Only the party owner can ban members')
  party.members = party.members.filter((m) => String(m) !== req.body.userId)
  if (!party.banned.some((id) => String(id) === req.body.userId)) party.banned.push(req.body.userId)
  await party.save()
  res.json(party)
}

// PUT /api/parties/:id/votes { sectionIds } — my preferred slots for the party's module
export async function saveVotes(req, res) {
  const party = await findPartyForMember(req)
  const sectionIds = [...new Set(req.body.sectionIds ?? [])]
  const valid = await Section.countDocuments({ sectionId: { $in: sectionIds }, module: party.module })
  if (valid !== sectionIds.length) throw httpError(400, `All sections must belong to ${party.module}`)

  const mine = party.votes.find((v) => v.user.equals(req.user._id))
  if (mine) mine.sectionIds = sectionIds
  else party.votes.push({ user: req.user._id, sectionIds })
  await party.save()
  res.json(party.votes)
}

// GET /api/parties/:id/votes — per-section counts and voters
export async function getVotes(req, res) {
  const party = await findPartyForMember(req)
  await party.populate('votes.user', MEMBER_FIELDS)
  const sections = await Section.find({ module: party.module }).sort({ day: 1, slot: 1 })
  res.json(
    sections.map((s) => {
      const voters = party.votes.filter((v) => v.sectionIds.includes(s.sectionId)).map((v) => v.user)
      return { section: s, count: voters.length, voters, finalised: party.finalisedSection === s.sectionId }
    }),
  )
}

// POST /api/parties/:id/finalise { sectionId } — owner locks in the agreed slot
export async function finaliseSection(req, res) {
  const party = await findPartyForMember(req)
  if (!isOwner(party, req.user)) throw httpError(403, 'Only the party owner can finalise a slot')
  party.finalisedSection = req.body.sectionId
  await party.save()
  res.json(party)
}

// PUT /api/parties/:id/plans { planIds } — share my What-If plans with the party
export async function sharePlans(req, res) {
  const party = await findPartyForMember(req)
  party.importedPlans = [
    ...party.importedPlans.filter((p) => !p.user.equals(req.user._id)),
    ...(req.body.planIds ?? []).map((plan) => ({ user: req.user._id, plan })),
  ]
  await party.save()
  res.json(party.importedPlans)
}

// POST /api/parties/:id/comments { module, text }
export async function addComment(req, res) {
  const party = await findPartyForMember(req)
  party.comments.push({ user: req.user._id, module: req.body.module, text: req.body.text })
  await party.save()
  res.status(201).json(party.comments.at(-1))
}
