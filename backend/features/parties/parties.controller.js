import crypto from 'crypto'; //apparently this is more secure than the math.random?
import Party from './models/Party.js';
import User from '../auth/models/User.js';
import Module from '../planning/models/Module.js';
import { loadSections } from '../bidding/section.repository.js';
import { canonicalTerm } from '../bidding/utils/sectionData.js';
import { toSectionView } from '../bidding/utils/sectionView.js';
import { unmetGroups } from '../planning/utils/requisites.js';
import { httpError } from '../../middleware/errorHandler.js';
import { alreadyTaken, prerequisitesBeforeTerm } from './utils/eligibility.js';
import { decisionSummary } from './utils/decision.js';
import { notify, displayName } from '../notifications/notifications.controller.js';

const MEMBER_FIELDS = 'name email';
const SECTION_STATUSES = ['considering', 'bidding', 'enrolled'];

async function missingPrereqs(user, moduleCode, termKey) {
  const mod = await Module.findById(moduleCode).lean();
  // Without the module there is nothing to check against, so it must not pass as "no prerequisites"
  if (!mod) throw httpError(404, `${moduleCode} is not in the course catalogue`);
  const available = new Set(prerequisitesBeforeTerm(user, termKey));
  const groups = unmetGroups(mod.prerequisites, (code) => available.has(code));
  const missing = groups.map((group) => group.join(' or '));

  // Rules like "2 track courses before this one"
  if (mod.prerequisiteRules?.length) {
    const done = await Module.find({ _id: { $in: [...available] } })
      .select('categories')
      .lean();
    for (const rule of mod.prerequisiteRules) {
      const isTrackRule = rule.countFrom === 'TRACK';
      const count = done.filter((other) => !isTrackRule || other.categories?.includes('IS_TRACK')).length;
      if (count < rule.n)
        missing.push(`${rule.n} ${isTrackRule ? 'track courses' : 'courses'} before this one`);
    }
  }
  return missing;
}

// "AY26/27 T2" or "2026-27_T2" -> "2026-27_T2", or a 400 for anything else
function partyTerm(value) {
  try {
    return canonicalTerm(value);
  } catch {
    throw httpError(400, 'termKey must be a term like 2026-27_T2');
  }
}

// The sections of the party's module in the party's term (any stored section format)
async function partySections(party) {
  return loadSections({ term: party.termKey, modules: [party.module] });
}

// Just the ids of the party's sections, e.g. ["IS216-G1", "IS216-G2", ...]
async function sectionIdsFor(party) {
  const sections = await partySections(party);
  const ids = [];
  for (const section of sections) {
    ids.push(section.sectionId);
  }
  return ids;
}

function isMember(party, userId) {
  return party.members.some((memberId) => memberId.equals(userId));
}

// Everyone in the party except the given user
function otherMembers(party, userId) {
  return party.members.filter((memberId) => !memberId.equals(userId));
}

// The link a notification opens: the party's room page
function roomLink(party) {
  return `/rooms/${party._id}`;
}

async function generateInviteCode(length = 6) {
  const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; //removed IL1 and O0 because they look similar
  while (true) {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += CHARS[crypto.randomInt(CHARS.length)];
    }
    const taken = await Party.exists({ inviteCode: code });
    if (!taken) {
      return code;
    }
  }
}

function removeUserFromParty(party, userId) {
  party.members = party.members.filter((memberId) => !memberId.equals(userId));
  party.votes = party.votes.filter((vote) => !vote.user.equals(userId));
  party.memberSections = party.memberSections.filter((entry) => !entry.user.equals(userId));
}

export async function listParties(req, res) {
  const parties = await Party.find({ members: req.user._id })
    .select('name description module termKey inviteCode maxMembers members memberSections updatedAt')
    .populate('members', MEMBER_FIELDS)
    .sort({ updatedAt: -1 });
  res.json(parties);
}

export async function createParty(req, res) {
  const { name, description, module, termKey, maxMembers } = req.body;
  if (!name || !module || !termKey) {
    throw httpError(400, 'name, module and termKey are required');
  }

  const term = partyTerm(termKey);
  if (alreadyTaken(req.user, module, term)) {
    throw httpError(
      409,
      `You have already taken ${module} or are taking it now, so you can't create a room for it`,
    );
  }
  // The same check everyone who joins has to pass
  const missing = await missingPrereqs(req.user, module, term);
  if (missing.length > 0) {
    return res
      .status(403)
      .json({ error: `Missing prerequisite for ${module}: ${missing.join('; ')}`, missing });
  }

  const party = new Party({
    name,
    description,
    module,
    termKey: term,
    maxMembers,
    inviteCode: await generateInviteCode(),
    owner: req.user._id,
    members: [req.user._id],
  });

  await party.save();
  res.status(201).json({ party });
}

export async function joinParty(req, res) {
  const inviteCode = String(req.body.inviteCode || '')
    .trim()
    .toUpperCase();
  const party = await Party.findOne({ inviteCode });
  if (!party) {
    throw httpError(404, 'No party found for that invite code');
  }

  const userId = req.user._id;
  if (isMember(party, userId)) {
    return res.json(party); // already in: nothing to do
  }
  if (party.banned.some((bannedId) => bannedId.equals(userId))) {
    throw httpError(403, 'You cannot join this party');
  }
  if (party.members.length >= party.maxMembers) {
    throw httpError(409, 'This party is full');
  }
  if (party.locked) {
    throw httpError(409, 'This party is locked and not taking new members');
  }

  if (alreadyTaken(req.user, party.module, party.termKey)) {
    throw httpError(
      409,
      `You have already taken ${party.module} or are taking it now, so you can't join this room`,
    );
  }

  const missing = await missingPrereqs(req.user, party.module, party.termKey);
  if (missing.length > 0) {
    return res
      .status(403)
      .json({ error: `Missing prerequisite for ${party.module}: ${missing.join('; ')}`, missing });
  }

  party.members.push(userId);
  await party.save();

  //notify other members of the change
  await notify(
    otherMembers(party, userId),
    'party_joined',
    `${displayName(req.user.name)} joined ${party.name}`,
    roomLink(party),
  );
  res.json(party);
}

// GET /api/parties/:id  (loadParty + requireMember run first)
export async function getParty(req, res) {
  const party = req.party;
  await party.populate([
    { path: 'members', select: MEMBER_FIELDS },
    { path: 'votes.user', select: MEMBER_FIELDS },
    { path: 'memberSections.user', select: MEMBER_FIELDS },
  ]);
  // Only the server knows which sections are still on offer, so it reports where the vote stands
  const summary = decisionSummary(party, await sectionIdsFor(party));
  res.json({ ...party.toJSON(), summary });
}

// DELETE /api/parties/:id  (owner only)
export async function deleteParty(req, res) {
  await req.party.deleteOne();
  res.status(204).end();
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

// DELETE /api/parties/:id/members/me: leave; the party is deleted when the last member leaves
export async function leaveParty(req, res) {
  const party = req.party;
  const userId = req.user._id;
  const wasOwner = party.owner.equals(userId);

  removeUserFromParty(party, userId);

  if (party.members.length === 0) {
    await party.deleteOne();
  } else {
    if (wasOwner) {
      party.owner = party.members[0]; // longest-standing remaining member takes over
    }
    await party.save();

    await notify(
      party.members,
      'party_left',
      `${displayName(req.user.name)} left ${party.name}`,
      roomLink(party),
    );

    // The new owner is also told they're in charge now
    if (wasOwner) {
      await notify(
        [party.owner],
        'party_owner_changed',
        `You're now the owner of ${party.name}`,
        roomLink(party),
      );
    }
  }
  res.status(204).end();
}

// POST /api/parties/:id/ban { userId }: owner removes a member and blocks them from rejoining
export async function banMember(req, res) {
  const party = req.party;
  const userId = req.body.userId;

  if (!userId) {
    throw httpError(400, 'userId is required');
  }
  if (party.owner.equals(userId)) {
    throw httpError(400, 'The owner cannot ban themselves');
  }

  const bannedUser = await User.findById(userId).select('name');
  const bannedName = displayName(bannedUser?.name) || 'Member';
  removeUserFromParty(party, userId);

  const alreadyBanned = party.banned.some((bannedId) => bannedId.equals(userId));
  if (!alreadyBanned) {
    party.banned.push(userId);
  }

  await party.save();

  // The banned student is told, with no link, since they can't open the room any more
  await notify([userId], 'party_banned', `You were removed from ${party.name}`);

  // The other members (not the owner who did it) are told who was removed
  await notify(
    otherMembers(party, req.user._id),
    'party_member_removed',
    `${bannedName} was removed from ${party.name}`,
    roomLink(party),
  );

  res.json(party);
}

// PUT /api/parties/:id/owner { userId }: owner hands the party admin role to another member
export async function transferOwner(req, res) {
  const party = req.party;
  const { userId } = req.body;

  if (typeof userId !== 'string' || !userId) {
    throw httpError(400, 'userId is required');
  }
  if (party.owner.equals(userId)) {
    throw httpError(400, 'This member is already the party admin');
  }
  if (!party.members.some((memberId) => memberId.equals(userId))) {
    throw httpError(400, 'Only a member of this party can become its admin');
  }

  party.owner = party.members.find((memberId) => memberId.equals(userId));
  await party.save();

  await notify(
    [party.owner],
    'party_owner_changed',
    `${displayName(req.user.name)} made you the party admin of ${party.name}`,
    roomLink(party),
  );
  res.json(party);
}

//currently no way to unban from front end yet
// DELETE /api/parties/:id/ban/:userId: owner lifts a ban (the user can then rejoin with the code)
export async function unbanMember(req, res) {
  const party = req.party;
  party.banned = party.banned.filter((bannedId) => !bannedId.equals(req.params.userId));
  await party.save();
  res.json(party);
}

// ---------------------------------------------------------------------------
// Sections: votes and "my section"
// ---------------------------------------------------------------------------

// PUT /api/parties/:id/votes { sectionIds }: sections I'd be happy with (replaces my old vote)
export async function saveVotes(req, res) {
  const party = req.party;
  const userId = req.user._id;
  const sectionIds = [...new Set(req.body.sectionIds || [])]; // Set removes duplicates

  const validIds = new Set((await partySections(party)).map((section) => section.sectionId));
  if (sectionIds.some((id) => !validIds.has(id))) {
    throw httpError(400, `All sections must belong to ${party.module} in ${party.termKey}`);
  }

  const myVote = party.votes.find((vote) => vote.user.equals(userId));
  if (myVote) {
    myVote.sectionIds = sectionIds;
  } else {
    party.votes.push({ user: userId, sectionIds });
  }

  await party.save();
  res.json(party.votes);
}

// DELETE /api/parties/:id/votes: take my votes back
export async function clearVotes(req, res) {
  const party = req.party;
  party.votes = party.votes.filter((vote) => !vote.user.equals(req.user._id));
  await party.save();
  res.status(204).end();
}

// PUT /api/parties/:id/my-section { sectionId, status }: the one section I'm going for
export async function setMySection(req, res) {
  const party = req.party;
  const userId = req.user._id;
  const { sectionId } = req.body;
  const status = req.body.status || 'considering';

  if (!sectionId) {
    throw httpError(400, 'sectionId is required');
  }
  if (!SECTION_STATUSES.includes(status)) {
    throw httpError(400, `status must be one of: ${SECTION_STATUSES.join(', ')}`);
  }
  const sectionExists = (await partySections(party)).some((section) => section.sectionId === sectionId);
  if (!sectionExists) {
    throw httpError(400, `That section does not belong to ${party.module} in ${party.termKey}`);
  }

  const mine = party.memberSections.find((entry) => entry.user.equals(userId));
  if (mine) {
    mine.sectionId = sectionId;
    mine.status = status;
    mine.updatedAt = new Date();
  } else {
    party.memberSections.push({ user: userId, sectionId, status });
  }

  await party.save();
  res.json(party.memberSections);
}

// DELETE /api/parties/:id/my-section: stop sharing my section
export async function clearMySection(req, res) {
  const party = req.party;
  party.memberSections = party.memberSections.filter((entry) => !entry.user.equals(req.user._id));
  await party.save();
  res.status(204).end();
}

// GET /api/parties/:id/sections
// Every section of the module, with who voted for it and who is going for it
export async function getSectionSummary(req, res) {
  const party = req.party;
  await party.populate([
    { path: 'votes.user', select: MEMBER_FIELDS },
    { path: 'memberSections.user', select: MEMBER_FIELDS },
  ]);
  const sections = await partySections(party);

  const summary = [];
  for (const section of sections) {
    const voters = [];
    for (const vote of party.votes) {
      if (vote.sectionIds.includes(section.sectionId)) {
        voters.push(vote.user);
      }
    }

    const goingFor = [];
    for (const entry of party.memberSections) {
      if (entry.sectionId === section.sectionId) {
        goingFor.push({
          user: entry.user,
          status: entry.status,
          updatedAt: entry.updatedAt,
        });
      }
    }

    // The same section shape as the bidding page (sessions, prof, exam, ...)
    summary.push({
      section: toSectionView(section),
      voteCount: voters.length,
      voters,
      goingFor,
    });
  }

  res.json(summary);
}

// POST /api/parties/:id/lock { sectionId }: owner locks the party (once everyone has voted)
export async function lockParty(req, res) {
  const party = req.party;
  const sectionId = req.body.sectionId;
  if (!sectionId) {
    throw httpError(400, 'sectionId is required');
  }

  //SEE IF WE WANT TO MAKE SURE EVERYONE VOTED BEFORE LOCKING:
  // =====================
  const summary = decisionSummary(party, await sectionIdsFor(party));
  if (!summary.allVoted) {
    throw httpError(409, 'Wait until everyone has voted before locking the party');
  }
  if (!summary.leaders.includes(sectionId)) {
    throw httpError(400, `Choose one of the leading sections: ${summary.leaders.join(', ')}`);
  }
  //=====================
  party.locked = true;
  party.lockedSection = sectionId;
  party.lockedAt = new Date();
  await party.save();

  await notify(
    otherMembers(party, req.user._id),
    'party_vote_locked',
    `${party.name} is locked: the group chose ${sectionId}`,
    roomLink(party),
  );

  res.json(decisionSummary(party, await sectionIdsFor(party)));
}

// DELETE /api/parties/:id/lock: owner unlocks the party so it can change again
export async function unlockParty(req, res) {
  const party = req.party;
  party.locked = false;
  party.lockedSection = null;
  party.lockedAt = null;
  await party.save();

  await notify(
    otherMembers(party, req.user._id),
    'party_vote_unlocked',
    `${party.name} was unlocked: votes can change again`,
    roomLink(party),
  );

  res.json(decisionSummary(party, await sectionIdsFor(party)));
}
