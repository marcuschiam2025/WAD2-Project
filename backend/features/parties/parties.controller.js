import crypto from "crypto"; //apparently this is more secure than the math.random?
import Party from "./models/Party.js";
import User from "../auth/models/User.js";
import Module from "../planning/models/Module.js";
import { loadSections } from "../bidding/section.repository.js";
import { canonicalTerm } from "../bidding/utils/sectionData.js";
import { toSectionView } from "../bidding/utils/sectionView.js";
import { unmetGroups } from "../planning/utils/requisites.js";
import { httpError } from "../../middleware/errorHandler.js";

const MEMBER_FIELDS = "name email";
const SECTION_STATUSES = ["considering", "bidding", "enrolled"];

async function missingPrereqs(user, moduleCode) {
  const mod = await Module.findById(moduleCode).lean();
  const groups = unmetGroups(mod?.prerequisites, (code) =>
    user.completedModules.includes(code),
  );
  return groups.map((group) => group.join(" or "));
}

// "AY26/27 T2" or "2026-27_T2" -> "2026-27_T2", or a 400 for anything else
function partyTerm(value) {
  try {
    return canonicalTerm(value);
  } catch {
    throw httpError(400, "termKey must be a term like 2026-27_T2");
  }
}

// The sections of the party's module in the party's term (any stored section format)
async function partySections(party) {
  return loadSections({ term: party.termKey, modules: [party.module] });
}

function isMember(party, userId) {
  return party.members.some((memberId) => memberId.equals(userId));
}

async function generateInviteCode(length = 6) {
  const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  while (true) {
    let code = "";
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
  party.memberSections = party.memberSections.filter(
    (entry) => !entry.user.equals(userId),
  );
}

export async function listParties(req, res) {
  const parties = await Party.find({ members: req.user._id })
    .select(
      "name description module termKey inviteCode maxMembers members updatedAt",
    )
    .populate("members", MEMBER_FIELDS)
    .sort({ updatedAt: -1 });
  res.json(parties);
}

export async function createParty(req, res) {
  const { name, description, module, termKey, maxMembers } = req.body;
  const memberEmails = req.body.memberEmails || [];
  const emails = memberEmails.map((email) => String(email).toLowerCase()) //convert emails to lowercase within the list
  const invitees = await User.find({ email: { $in: emails } })//goes through the list find invited classmates, puts it into an object
  const blocked = []; // different from banned. block is not saved to the mongoDB


  if (!name || !module || !termKey) {
    throw httpError(400, "name, module and termKey are required");
  }

  const party = new Party({
    name,
    description,
    module,
    termKey: partyTerm(termKey),
    maxMembers,
    inviteCode: await generateInviteCode(),
    owner: req.user._id,
    members: [req.user._id],
  });

  //invites the members (invitees is a list of objects, each object being a user)
  for (const invitee of invitees) {
    if (party.members.length >= party.maxMembers) break; 

    const missing = await missingPrereqs(invitee, module);

    if (missing.length > 0) {
      blocked.push({ email: invitee.email, name: invitee.name, missing });
    } else if (!isMember(party, invitee._id)) {
      party.members.push(invitee._id);
    }
  }

  await party.save();
  res.status(201).json({ party, blocked });
}

export async function joinParty(req, res) {
  const inviteCode = String(req.body.inviteCode || "")
    .trim()
    .toUpperCase();
  const party = await Party.findOne({ inviteCode });
  if (!party) {
    throw httpError(404, "No party found for that invite code");
  }

  const userId = req.user._id;
  if (isMember(party, userId)) {
    return res.json(party); // already in: nothing to do
  }
  if (party.banned.some((bannedId) => bannedId.equals(userId))) {
    throw httpError(403, "You cannot join this party");
  }
  if (party.members.length >= party.maxMembers) {
    throw httpError(409, "This party is full");
  }

  const missing = await missingPrereqs(req.user, party.module);
  if (missing.length > 0) {
    return res
      .status(403)
      .json({ error: `Missing prerequisite for ${party.module}`, missing });
  }

  party.members.push(userId);
  await party.save();
  res.json(party);
}

// GET /api/parties/:id  (loadParty + requireMember run first)
export async function getParty(req, res) {
  const party = req.party;
  await party.populate([
    { path: "members", select: MEMBER_FIELDS },
    { path: "votes.user", select: MEMBER_FIELDS },
    { path: "memberSections.user", select: MEMBER_FIELDS },
  ]);
  res.json(party);
}

// DELETE /api/parties/:id  (owner only)
export async function deleteParty(req, res) {
  await req.party.deleteOne();
  res.status(204).end();
}

// GET /api/parties/:id/updates?since=<ISO date>
// Short-polling: 204 (no body) when nothing changed since the given time
export async function getUpdates(req, res) {
  const party = req.party;
  const since = new Date(req.query.since || 0);

  if (party.updatedAt <= since) {
    return res.status(204).end();
  }
  await party.populate([
    { path: "members", select: MEMBER_FIELDS },
    { path: "memberSections.user", select: MEMBER_FIELDS },
  ]);
  res.json(party);
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

// DELETE /api/parties/:id/members/me — leave; the party is deleted when the last member leaves
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
  }
  res.status(204).end();
}

// POST /api/parties/:id/ban { userId } — owner removes a member and blocks them from rejoining
export async function banMember(req, res) {
  const party = req.party;
  const userId = req.body.userId;

  if (!userId) {
    throw httpError(400, "userId is required");
  }
  if (party.owner.equals(userId)) {
    throw httpError(400, "The owner cannot ban themselves");
  }

  removeUserFromParty(party, userId);

  const alreadyBanned = party.banned.some((bannedId) =>
    bannedId.equals(userId),
  );
  if (!alreadyBanned) {
    party.banned.push(userId);
  }

  await party.save();
  res.json(party);
}

// DELETE /api/parties/:id/ban/:userId — owner lifts a ban (the user can then rejoin with the code)
export async function unbanMember(req, res) {
  const party = req.party;
  party.banned = party.banned.filter(
    (bannedId) => !bannedId.equals(req.params.userId),
  );
  await party.save();
  res.json(party);
}

// ---------------------------------------------------------------------------
// Sections: votes and "my section"
// ---------------------------------------------------------------------------

// PUT /api/parties/:id/votes { sectionIds } — sections I'd be happy with (replaces my old vote)
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

// DELETE /api/parties/:id/votes — take my votes back
export async function clearVotes(req, res) {
  const party = req.party
  party.votes = party.votes.filter((vote) => !vote.user.equals(req.user._id))
  await party.save()
  res.status(204).end()
}

// PUT /api/parties/:id/my-section { sectionId, status } — the one section I'm going for
export async function setMySection(req, res) {
  const party = req.party;
  const userId = req.user._id;
  const { sectionId } = req.body;
  const status = req.body.status || "considering";

  if (!sectionId) {
    throw httpError(400, "sectionId is required");
  }
  if (!SECTION_STATUSES.includes(status)) {
    throw httpError(
      400,
      `status must be one of: ${SECTION_STATUSES.join(", ")}`,
    );
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

// DELETE /api/parties/:id/my-section — stop sharing my section
export async function clearMySection(req, res) {
  const party = req.party;
  party.memberSections = party.memberSections.filter(
    (entry) => !entry.user.equals(req.user._id),
  );
  await party.save();
  res.status(204).end();
}

// GET /api/parties/:id/sections
// Every section of the module, with who voted for it and who is going for it
export async function getSectionSummary(req, res) {
  const party = req.party;
  await party.populate([
    { path: "votes.user", select: MEMBER_FIELDS },
    { path: "memberSections.user", select: MEMBER_FIELDS },
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
    summary.push({ section: toSectionView(section), voteCount: voters.length, voters, goingFor });
  }

  res.json(summary);
}
