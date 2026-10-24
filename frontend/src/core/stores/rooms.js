import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { classmates, roomPrereqs } from '../data/rooms'
import { useUserStore } from './user'
import { sections } from '../data/bidding'

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
  const rooms = ref([])
  // room id -> section ids the signed-in student picked
  const myVotes = ref({})

  // room id -> the section the signed-in student accepted
  const accepted = ref({})
  const user = useUserStore()
  watch(() => user.uid, () => {
    rooms.value = []
    myVotes.value = {}
    accepted.value = {}
  }, { flush: 'sync' })

  const hasVoted = (room, id) =>
    id === ME ? (myVotes.value[room.id] ?? []).length > 0 : Object.values(room.votes).some((v) => v.includes(id))

  // Who voted for a section (the signed-in student first)
  function votersOf(room, sectionId) {
    const mine = (myVotes.value[room.id] ?? []).includes(sectionId)
    return [...(mine ? [ME] : []), ...(room.votes[sectionId] ?? [])]
  }

  // Where a room stands. Once everyone has voted, the section(s) with the most votes can be accepted.
  // Several sections on the same top count is a tie: the student accepts exactly one of them.
  function roomState(room) {
    const waiting = room.members.filter((id) => !hasVoted(room, id))
    const mine = myVotes.value[room.id] ?? []
    const voted = [...new Set([...mine, ...Object.keys(room.votes)])].filter((sid) => sections.some((s) => s.id === sid))
    const top = Math.max(0, ...voted.map((sid) => votersOf(room, sid).length))
    const leaders = top ? voted.filter((sid) => votersOf(room, sid).length === top).sort() : []
    const allVoted = waiting.length === 0
    const pick = accepted.value[room.id]
    return {
      voted: room.members.length - waiting.length,
      total: room.members.length,
      waiting,
      allVoted,
      top,
      leaders,
      tie: leaders.length > 1,
      acceptedId: allVoted && leaders.includes(pick) ? pick : null,
    }
  }

  // Accepted sections. They also land in the What-If Planner basket and on the Bidding Planner timetable.
  // TODO(backend): PUT /api/rooms/:id/accept
  const decided = computed(() =>
    rooms.value.flatMap((room) => {
      const st = roomState(room)
      return st.acceptedId ? [{ roomId: room.id, roomName: room.name, module: room.module, sectionId: st.acceptedId }] : []
    }),
  )

  function acceptSection(roomId, sectionId) {
    const st = roomState(getRoom(roomId))
    if (st.allVoted && st.leaders.includes(sectionId)) accepted.value[roomId] = sectionId
  }

  function undoAccept(roomId) {
    delete accepted.value[roomId]
  }

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

  // A unique 6-digit code, which is also the room's id
  function newRoomCode() {
    let code
    do code = String(Math.floor(100000 + Math.random() * 900000))
    while (rooms.value.some((r) => r.id === code))
    return code
  }

  // TODO(Backend 2): POST /api/rooms
  function createRoom({ name, description, module, maxMembers, members }) {
    const id = newRoomCode()
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
    delete accepted.value[roomId]
  }

  // Take the signed-in student's picks back (and the bids they suggested for those sections)
  // TODO(Backend 2): DELETE /api/rooms/:id/votes/me
  function clearMyVotes(roomId) {
    myVotes.value[roomId] = []
    delete accepted.value[roomId]
    Object.values(getRoom(roomId).suggestedBids).forEach((bids) => delete bids[ME])
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
    delete accepted.value[roomId]
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

  return {
    rooms,
    myVotes,
    decided,
    roomState,
    votersOf,
    acceptSection,
    undoAccept,
    getRoom,
    person,
    searchClassmates,
    missingPrereq,
    createRoom,
    leaveRoom,
    setMyVotes,
    clearMyVotes,
    setMyBid,
    kickMember,
    setAdmin,
  }
})

// Dev only: lets Vite swap this store's code in when the file is edited, instead of keeping the old store
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useRoomsStore, import.meta.hot))
