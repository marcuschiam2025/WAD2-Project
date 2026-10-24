import crypto from 'node:crypto'
import Party from './models/Party.js'
import Module from '../planning/models/Module.js'
import { loadSections, roundSettings } from '../bidding/section.repository.js'
import { canonicalTerm } from '../bidding/utils/sectionData.js'
import { toSectionView } from '../bidding/utils/sectionView.js'
import { unmetGroups } from '../planning/utils/requisites.js'
import { httpError } from '../../middleware/errorHandler.js'

const MEMBER_FIELDS = 'name email'

// Unmet prerequisite groups as text, e.g. ['IS111 or CS101']
async function missingPrereqs(user, moduleCode) {
  const mod = await Module.findById(moduleCode).lean()
  return unmetGroups(mod?.prerequisites, (c) => user.completedModules.includes(c)).map((g) => g.join(' or '))
}

async function uniqueInviteCode() {
  for (;;) {
    const code = crypto.randomBytes(3).toString('hex').toUpperCase()
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
    .select('name description module inviteCode maxMembers members owner votes updatedAt')
    .populate('members', MEMBER_FIELDS)
    .sort({ updatedAt: -1 })
  res.json(parties)
}

// POST /api/parties { name, module } — creator is the party admin.
export async function createParty(req, res) {
  const { name, module } = req.body
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || typeof module !== 'string' || !/^[A-Z][A-Z0-9-]{1,24}$/.test(module)) throw httpError(400, 'Provide a party name and valid module code')
  if (!await Module.exists({ _id: module })) throw httpError(400, 'Choose a module from the catalogue')
  const party = new Party({ name: name.trim(), module, inviteCode: await uniqueInviteCode(), owner: req.user._id, members: [req.user._id] })
  await party.save()
  await party.populate('members', MEMBER_FIELDS)
  res.status(201).json({ party })
}

// POST /api/parties/join { inviteCode }
export async function joinParty(req, res) {
  const inviteCode = typeof req.body.inviteCode === 'string' ? req.body.inviteCode.trim().toUpperCase() : ''
  if (!/^[A-Z0-9]{4,8}$/.test(inviteCode)) throw httpError(400, 'Enter a room code of 4–8 letters or numbers')
  const party = await Party.findOne({ inviteCode })
  if (!party) throw httpError(404, 'No party found for that invite code')
  if (isMember(party, req.user)) { await party.populate('members', MEMBER_FIELDS); return res.json(party) }
  if (party.banned.some((id) => id.equals(req.user._id))) throw httpError(403, 'You cannot join this party')
  if (party.members.length >= party.maxMembers) throw httpError(409, 'This party is full')

  const missing = await missingPrereqs(req.user, party.module)
  if (missing.length) {
    return res.status(403).json({ error: `Missing prerequisite for ${party.module}`, missing })
  }

  // Capacity is checked in the write so simultaneous joins cannot overfill a room.
  const joined = await Party.findOneAndUpdate({ _id: party._id, banned: { $ne: req.user._id },
    $or: [{ members: req.user._id }, { $expr: { $lt: [{ $size: '$members' }, '$maxMembers'] } }] },
    { $addToSet: { members: req.user._id } }, { new: true, runValidators: true })
  if (!joined) throw httpError(409, 'This room is full or no longer available')
  await joined.populate('members', MEMBER_FIELDS)
  res.json(joined)
}

// GET /api/parties/:id
export async function getParty(req, res) {
  const party = await findPartyForMember(req)
  await party.populate([
    { path: 'members', select: MEMBER_FIELDS },
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

async function votingTerm(party, requested) {
  let term
  try { term = canonicalTerm(requested ?? party.term ?? (await roundSettings()).term) }
  catch { throw httpError(400, 'A valid section catalogue term is required') }
  if (party.term && term !== party.term) throw httpError(409, 'This party is voting for a different term. Refresh the room.')
  return term
}

// A ballot replaces only the signed-in member's picks. The room pins its term on first save.
export async function saveVotes(req, res) {
  const party = await findPartyForMember(req)
  const { sectionIds } = req.body
  if (!Array.isArray(sectionIds) || sectionIds.length > 100 || sectionIds.some(id => typeof id !== 'string' || !id.trim())) throw httpError(400, 'sectionIds must be an array of section IDs')
  const term = await votingTerm(party, req.body.term)
  const ids = [...new Set(sectionIds)]
  if (ids.some(id => id.includes(':') && (id.split(':').length !== 3 || !id.startsWith(`${term}:${party.module}:`) || !id.split(':')[2]))) throw httpError(400, `Choose sections of ${party.module} in ${term}`)
  const sections = ids.length ? await loadSections({ term, modules: [party.module], ids }) : []
  if (sections.length !== ids.length || sections.some(section => section.module !== party.module || section.term !== term || !ids.includes(section.sectionId))) throw httpError(400, `Choose sections of ${party.module} in ${term}`)
  const updated = await Party.findOneAndUpdate({ _id: party._id, members: req.user._id, term: { $in: [null, term] } }, [{ $set: {
    term,
    votes: { $concatArrays: [{ $filter: { input: { $ifNull: ['$votes', []] }, as: 'ballot', cond: { $ne: ['$$ballot.user', req.user._id] } } }, [{ user: req.user._id, sectionIds: ids }]] },
    finalisedSection: null,
  } }], { new: true })
  if (!updated) throw httpError(409, 'Membership or voting term changed. Refresh the room before saving.')
  res.json({ term, sectionIds: ids })
}

export async function getVotes(req, res) {
  const party = await findPartyForMember(req)
  const term = await votingTerm(party, req.query?.term)
  const sections = await loadSections({ term, modules: [party.module] })
  await party.populate('votes.user', MEMBER_FIELDS)
  const memberIds = new Set(party.members.map(member => String(member._id ?? member)))
  const validIds = new Set(sections.map(section => section.sectionId))
  const ballots = party.votes.filter(ballot => ballot.user && memberIds.has(String(ballot.user._id ?? ballot.user)))
  const mine = ballots.find(ballot => String(ballot.user._id ?? ballot.user) === String(req.user._id))
  res.json({ term, memberCount: memberIds.size,
    votedCount: new Set(ballots.filter(ballot => ballot.sectionIds.some(id => validIds.has(id))).map(ballot => String(ballot.user._id ?? ballot.user))).size,
    mySectionIds: (mine?.sectionIds ?? []).filter(id => validIds.has(id)),
    missingSectionIds: (mine?.sectionIds ?? []).filter(id => !validIds.has(id)),
    rows: sections.map(section => {
      const voters = [...new Map(ballots.filter(ballot => ballot.sectionIds.includes(section.sectionId)).map(ballot => [String(ballot.user._id), { _id: String(ballot.user._id), name: ballot.user.name || 'Member' }])).values()]
      return { section: toSectionView(section), count: voters.length, voters }
    }),
  })
}

// POST /api/parties/:id/finalise { sectionId } — owner locks in the agreed slot
export async function finaliseSection(req, res) {
  const party = await findPartyForMember(req)
  if (!isOwner(party, req.user)) throw httpError(403, 'Only the party owner can finalise a slot')
  party.finalisedSection = req.body.sectionId
  await party.save()
  res.json(party)
}

// POST /api/parties/:id/comments { module, text }
export async function addComment(req, res) {
  const party = await findPartyForMember(req)
  party.comments.push({ user: req.user._id, module: req.body.module, text: req.body.text })
  await party.save()
  res.status(201).json(party.comments.at(-1))
}
