// Turns a user object into a plain id string
export function idOf(value) {
  if (value && value._id !== undefined && value._id !== null) {
    return String(value._id)
  }
  return String(value)
};


//“Where does the vote stand right now?”
// compiles votes
export function decisionSummary(party, validSectionIds) {
  // 1. The members, as id strings, without duplicates
  const members = []
  for (const member of party.members) {
    const id = idOf(member)
    if (!members.includes(id)) members.push(id)
  }
 
  // 2. Votes from people who aren't members are ignored. 
  // ^^optional check. database already cleaned, other functions for ban and leave delete the vote
  // const picksByMember = {} // { userId: ['IS216-G2', ...] }
  // for (const vote of party.votes || []) {
  //   const userId = idOf(vote.user)
  //   if (!members.includes(userId)) continue
 
  //   const picks = []
  //   for (const sectionId of vote.sectionIds) {
  //     if (validSectionIds.includes(sectionId) && !picks.includes(sectionId)) {
  //       picks.push(sectionId)
  //     }
  //   }
  //   picksByMember[userId] = picks
  // }
 
  // 3. Members who haven't picked any valid section yet
  const waitingIds = []
  for (const id of members) {
    const picks = picksByMember[id]
    if (!picks || picks.length === 0) waitingIds.push(id)
  }
 
  // 4. Count the votes for each section (every valid section starts at 0)
  const counts = {} // { 'IS216-G2': 2, 'IS216-G5': 1, ... }
  for (const sectionId of validSectionIds) {
    counts[sectionId] = 0
  }
  for (const userId of Object.keys(picksByMember)) {
    for (const sectionId of picksByMember[userId]) {
      counts[sectionId] = counts[sectionId] + 1
    }
  }
 
  // 5. The highest count, and every section that has it
  let top = 0
  for (const sectionId of Object.keys(counts)) {
    if (counts[sectionId] > top) top = counts[sectionId]
  }
  const leaders = []
  if (top > 0) {
    for (const sectionId of Object.keys(counts)) {
      if (counts[sectionId] === top) leaders.push(sectionId)
    }
    leaders.sort()
  }
 
  // 6. The overall state
  const allVoted = members.length > 0 && waitingIds.length === 0
 
  // A finalised section only counts while everyone has voted and it's still one of the leaders
  let finalisedSection = null
  if (allVoted && leaders.includes(party.finalisedSection)) {
    finalisedSection = party.finalisedSection
  }
 
  let status = 'voting'                    // still waiting for votes
  if (finalisedSection) status = 'confirmed' // the owner locked in a leading section
  else if (allVoted && top > 0) status = 'ready' // everyone voted; a decision can be made
 
  return {
    memberCount: members.length,
    votedCount: members.length - waitingIds.length,
    waitingIds,
    allVoted,
    top,
    leaders,
    tie: leaders.length > 1,
    finalisedSection,
    status,
  }
}