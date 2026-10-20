import { defineStore } from 'pinia'
import { ref } from 'vue'
import { classmates, rooms as sampleRooms, roomPrereqs } from '../data/rooms'

export const MAX_ROOM_SIZE = 8
const ME = 'me'

// owner > admin > member
export function roleOf(room, id) {
  if (room.ownerId === id) return 'owner'
  return room.admins.includes(id) ? 'admin' : 'member'
}

// The owner can remove anyone; admins can only remove regular members.
export function canKick(room, actorId, targetId) {
  if (actorId === targetId) return false
  const actor = roleOf(room, actorId)
  return actor === 'owner' || (actor === 'admin' && roleOf(room, targetId) === 'member')
}

// Only the owner promotes and demotes admins.
export function canSetAdmin(room, actorId, targetId) {
  return actorId !== targetId && roleOf(room, actorId) === 'owner' && roleOf(room, targetId) !== 'owner'
}

export const useRoomsStore = defineStore('rooms', () => {
  const rooms = ref(structuredClone(sampleRooms))
  // room id -> section ids the signed-in student picked
  const myVotes = ref({ A1F3: ['IS442-G1', 'IS442-G2'] })
  // room id -> plan ids imported into the room
  const importedPlans = ref({})

  function getRoom(id) {
    return rooms.value.find((r) => r.id === id)
  }

  function person(id) {
    if (id === ME) return { id: ME, name: 'You', short: 'You', initials: 'VS', you: true }
    return classmates.find((c) => c.id === id)
  }

  function searchClassmates(query, exclude = []) {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return classmates.filter(
      (c) => !exclude.includes(c.id) && (c.name.toLowerCase().includes(q) || c.email.includes(q)),
    )
  }

  // Returns the prerequisite the classmate is missing for the module, or null
  function missingPrereq(classmateId, moduleCode) {
    const req = roomPrereqs[moduleCode]
    const c = classmates.find((x) => x.id === classmateId)
    if (!req || !c) return null
    return c.completed.includes(req.code) ? null : req
  }

  // TODO(Backend 2): POST /api/rooms
  function createRoom({ name, description, module, maxMembers, members }) {
    const id = Math.random().toString(16).slice(2, 6).toUpperCase()
    rooms.value.unshift({
      id,
      name,
      description,
      module,
      maxMembers,
      ownerId: ME,
      admins: [],
      members: [ME, ...members],
      votes: { [`${module}-G1`]: [], [`${module}-G2`]: [], [`${module}-G3`]: [] },
      suggestedBids: {},
    })
    return id
  }

  function leaveRoom(id) {
    rooms.value = rooms.value.filter((r) => r.id !== id)
  }

  function setMyVotes(roomId, sectionIds) {
    myVotes.value[roomId] = sectionIds
  }

  // The signed-in student's suggested e$ for one section of the room's module
  // TODO(Backend 2): PUT /api/rooms/:id/sections/:sectionId/bids/me
  function setMyBid(roomId, sectionId, amount) {
    const bids = getRoom(roomId).suggestedBids
    bids[sectionId] = { ...bids[sectionId], [ME]: amount }
  }

  // TODO(Backend 2): DELETE /api/rooms/:id/members/:memberId (owner, or admin for regular members)
  function kickMember(roomId, memberId) {
    const room = getRoom(roomId)
    if (!room || !canKick(room, ME, memberId)) return
    room.members = room.members.filter((m) => m !== memberId)
    room.admins = room.admins.filter((m) => m !== memberId)
    Object.keys(room.votes).forEach((s) => (room.votes[s] = room.votes[s].filter((m) => m !== memberId)))
    Object.values(room.suggestedBids).forEach((bids) => delete bids[memberId])
  }

  // TODO(Backend 2): PATCH /api/rooms/:id/members/:memberId { role: 'admin' | 'member' } (owner only)
  function setAdmin(roomId, memberId, makeAdmin) {
    const room = getRoom(roomId)
    if (!room || !canSetAdmin(room, ME, memberId)) return
    const rest = room.admins.filter((m) => m !== memberId)
    room.admins = makeAdmin ? [...rest, memberId] : rest
  }

  function importPlans(roomId, planIds) {
    importedPlans.value[roomId] = planIds
  }

  return {
    rooms,
    myVotes,
    importedPlans,
    getRoom,
    person,
    searchClassmates,
    missingPrereq,
    createRoom,
    leaveRoom,
    setMyVotes,
    setMyBid,
    kickMember,
    setAdmin,
    importPlans,
  }
})
