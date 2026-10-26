// Builds a room's vote board from GET /api/parties/:id and GET /api/parties/:id/sections. Pure functions.
// The counting rules match backend/features/parties/utils/decision.js.

export const idOf = (value) => String(value?._id ?? value)

/**
 * @param {object} party    the party (members, owner, votes, memberSections, termKey), members populated
 * @param {Array}  summary  [{ section, voteCount, voters, goingFor }] for the party's module and term
 * @param {string} myId     the signed-in student's user id
 */
export function buildRoomBoard(party, summary, myId) {
  const members = (party.members ?? []).map((member) => ({ _id: idOf(member), name: member?.name || 'Member' }))
  const memberIds = members.map((member) => member._id)
  const validIds = new Set(summary.map((row) => row.section.id))

  // Each member's ballot, keeping only sections still offered in the party's term
  const ballots = new Map()
  for (const ballot of party.votes ?? []) {
    const id = idOf(ballot.user)
    if (memberIds.includes(id)) ballots.set(id, [...new Set(ballot.sectionIds.filter((sectionId) => validIds.has(sectionId)))])
  }
  const myBallot = (party.votes ?? []).find((ballot) => idOf(ballot.user) === myId)?.sectionIds ?? []

  const waitingIds = memberIds.filter((id) => !ballots.get(id)?.length)
  const counts = new Map(summary.map((row) => [row.section.id, 0]))
  for (const picks of ballots.values()) for (const id of picks) counts.set(id, counts.get(id) + 1)
  const top = Math.max(0, ...counts.values())
  const leaders = top ? [...counts].filter(([, count]) => count === top).map(([id]) => id).sort() : []
  const allVoted = memberIds.length > 0 && waitingIds.length === 0

  // Each member picks their own section; mine is shown as the room result
  const mine = (party.memberSections ?? []).find((entry) => idOf(entry.user) === myId)

  return {
    term: party.termKey,
    ownerId: idOf(party.owner),
    members,
    memberCount: memberIds.length,
    votedCount: memberIds.length - waitingIds.length,
    waitingIds,
    allVoted,
    top,
    leaders,
    tie: leaders.length > 1,
    finalisedSection: mine?.sectionId ?? null,
    myStatus: mine?.status ?? null,
    mySectionIds: myBallot.filter((id) => validIds.has(id)),
    missingSectionIds: myBallot.filter((id) => !validIds.has(id)),
    rows: summary.map((row) => ({
      section: row.section,
      count: counts.get(row.section.id) ?? 0,
      voters: (row.voters ?? []).filter(Boolean).map((voter) => ({ _id: idOf(voter), name: voter.name || 'Member' })),
      goingFor: (row.goingFor ?? []).map((entry) => ({ _id: idOf(entry.user), name: entry.user?.name || 'Member', status: entry.status })),
    })),
  }
}
