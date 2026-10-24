export const idOf = value => String(value?._id ?? value)

export function decisionSummary(party, validSectionIds) {
  const members = [...new Set(party.members.map(idOf))]
  const valid = new Set(validSectionIds)
  const ballots = new Map()
  for (const ballot of party.votes ?? []) {
    const id = idOf(ballot.user)
    if (members.includes(id)) ballots.set(id, [...new Set(ballot.sectionIds.filter(section => valid.has(section)))])
  }
  const counts = new Map([...valid].map(id => [id, 0]))
  const waitingIds = members.filter(id => !ballots.get(id)?.length)
  for (const picks of ballots.values()) for (const id of picks) counts.set(id, counts.get(id) + 1)
  const top = Math.max(0, ...counts.values())
  const leaders = top ? [...counts].filter(([, count]) => count === top).map(([id]) => id).sort() : []
  const allVoted = members.length > 0 && waitingIds.length === 0
  const finalisedSection = allVoted && leaders.includes(party.finalisedSection) ? party.finalisedSection : null
  return { memberCount: members.length, votedCount: members.length - waitingIds.length, waitingIds, allVoted, top, leaders, tie: leaders.length > 1, finalisedSection, status: finalisedSection ? 'confirmed' : allVoted && top ? 'ready' : 'voting' }
}
