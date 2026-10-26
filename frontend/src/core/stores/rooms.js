import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { api } from '../services/api'
import { classmates, roomPrereqs } from '../data/rooms'
import { useUserStore } from './user'
import { sections } from '../data/bidding'
import { buildRoomBoard } from '../utils/roomBoard'

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
  const people = ref({})
  const voteBoards = ref({}), voteLoading = ref({}), voteSaving = ref({}), voteErrors = ref({})
  const voteRequests = new Map()
  const loading = ref(false), busy = ref(false), online = ref(false), error = ref('')
  let revision = 0, listRequest = 0
  // room id -> section ids the signed-in student picked
  const myVotes = ref({})

  // room id -> the section the signed-in student accepted
  const accepted = ref({})
  const user = useUserStore()
  watch(() => user.uid, () => {
    revision++; listRequest++
    voteBoards.value = {}; voteLoading.value = {}; voteSaving.value = {}; voteErrors.value = {}; voteRequests.clear()
    people.value = {}; loading.value = false; busy.value = false; online.value = false; error.value = ''
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
    const board = voteBoards.value[room?.id] ?? room?.summary ?? {}
    return { ...board, voted: board.votedCount ?? 0, total: board.memberCount ?? room?.members.length ?? 0,
      waiting: board.waitingIds ?? [], leaders: board.leaders ?? [], acceptedId: board.finalisedSection ?? null }
  }

  // Shared decisions do not automatically edit any member's personal plans.
  // Each member explicitly imports the confirmed section into one bidding cart.
  const decided = computed(() => [])

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
    if (id === ME) return { id: ME, name: 'You', short: 'You', initials: user.profile.initials || 'You', you: true }
    return people.value[id] ?? { id, name: 'Member', short: 'Member', initials: '?', you: false }
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

  function normalize(party) {
    const myId = String(user.profile._id ?? '')
    const memberId = member => {
      const id = String(member?._id ?? member)
      return id === myId || (member?.email && member.email === user.profile.email) ? ME : id
    }
    const members = (party.members ?? []).map(member => {
      const id = memberId(member)
      if (typeof member === 'object') {
        const name = member.name || 'Member'
        people.value[id] = { id, name, short: name, email: member.email, initials: name.split(/\s+/).slice(0,2).map(word => word[0]).join('').toUpperCase(), you: id === ME }
      }
      return id
    })
    const votes = {}
    myVotes.value[String(party._id)] = []
    for (const ballot of party.votes ?? []) {
      const id = memberId(ballot.user)
      if (id === ME) myVotes.value[String(party._id)] = ballot.sectionIds
      else for (const sid of ballot.sectionIds) (votes[sid] ??= []).push(id)
    }
    return { id: String(party._id), name: party.name, description: party.description, module: party.module,
      inviteCode: party.inviteCode, maxMembers: party.maxMembers, ownerId: memberId(party.owner),
      admins: [], members, votes, suggestedBids: {}, term: party.termKey, summary: party.summary, updatedAt: party.updatedAt }
  }
  function upsert(party) {
    const room = normalize(party)
    rooms.value = [room, ...rooms.value.filter(existing => existing.id !== room.id)]
    return room.id
  }
  async function load() {
    const version = revision, request = ++listRequest
    if (!user.isSignedIn) return
    loading.value = true; error.value = ''
    try {
      const data = await api.rooms()
      if (version !== revision || request !== listRequest) return
      rooms.value = data.map(normalize)
      online.value = true
    } catch (failure) { if (version === revision && request === listRequest) error.value = failure.message }
    finally { if (version === revision && request === listRequest) loading.value = false }
  }
  async function mutate(action) {
    if (busy.value) throw new Error('A room request is already in progress.')
    const version = revision
    busy.value = true; error.value = ''; listRequest++; loading.value = false
    try {
      const party = await action()
      if (version !== revision) throw new Error('Your account changed. Please try again.')
      return upsert(party)
    } catch (failure) { if (version === revision) error.value = failure.message; throw failure }
    finally { if (version === revision) busy.value = false }
  }
  // A room is for one module in one term: the term BOSS is currently bidding for
  async function createRoom({ name, module }) {
    return mutate(async () => {
      const { term } = await api.round()
      if (!term) throw new Error('No bidding term is set yet, so a room cannot be created.')
      return (await api.createRoom({ name, module, termKey: term })).party
    })
  }
  async function joinRoom(code) {
    return mutate(() => api.joinRoom(code.trim().toUpperCase()))
  }
  async function leaveRoom(id) {
    const version = revision
    await api.leaveRoom(id)
    if (version !== revision) throw new Error('Your account changed.')
    listRequest++
    rooms.value = rooms.value.filter(room => room.id !== id)
    delete myVotes.value[id]; delete accepted.value[id]
  }

  async function loadVotes(roomId, { quiet = false } = {}) {
    const version = revision, request = (voteRequests.get(roomId) ?? 0) + 1
    voteRequests.set(roomId, request)
    voteLoading.value[roomId] = true
    if (!quiet) voteErrors.value[roomId] = ''
    try {
      const [party, summary] = await Promise.all([api.room(roomId), api.roomSections(roomId)])
      const board = buildRoomBoard(party, summary, String(user.profile._id ?? ''))
      if (version !== revision || request !== voteRequests.get(roomId)) return
      voteBoards.value[roomId] = board
      myVotes.value[roomId] = board.mySectionIds
      const room = getRoom(roomId)
      if (room) {
        room.summary = board
        room.term = board.term
        if (board.ownerId) room.ownerId = board.ownerId === String(user.profile._id) ? ME : board.ownerId
        if (board.members) room.members = board.members.map(member => {
          const id = member._id === String(user.profile._id) ? ME : member._id
          people.value[id] = { id, name: member.name, short: member.name, initials: member.name.split(/\s+/).slice(0,2).map(word => word[0]).join('').toUpperCase(), you: id === ME }
          return id
        })
      }
      return board
    } catch (failure) {
      if (version === revision && request === voteRequests.get(roomId)) {
        voteErrors.value[roomId] = failure.message
        if (failure.status === 403 || failure.status === 404) {
          delete voteBoards.value[roomId]; delete myVotes.value[roomId]
          rooms.value = rooms.value.filter(room => room.id !== roomId)
        }
      }
    } finally { if (version === revision && request === voteRequests.get(roomId)) voteLoading.value[roomId] = false }
  }
  async function saveRoomVotes(roomId, ids) {
    if (voteSaving.value[roomId] || !voteBoards.value[roomId]) return false
    const version = revision
    voteRequests.set(roomId, (voteRequests.get(roomId) ?? 0) + 1)
    voteLoading.value[roomId] = false
    voteSaving.value[roomId] = true; voteErrors.value[roomId] = ''
    try {
      await api.vote(roomId, [...ids])
      if (version !== revision) return false
      voteBoards.value[roomId] = { ...voteBoards.value[roomId], mySectionIds: [...ids] }
      myVotes.value[roomId] = [...ids]
      delete accepted.value[roomId]
      await loadVotes(roomId)
      return version === revision
    } catch (failure) { if (version === revision) voteErrors.value[roomId] = failure.message; return false }
    finally { if (version === revision) voteSaving.value[roomId] = false }
  }

  async function roomAction(roomId, action) {
    if (busy.value || voteSaving.value[roomId] || !voteBoards.value[roomId]) return false
    const version = revision
    busy.value = true; voteSaving.value[roomId] = true; voteErrors.value[roomId] = ''
    listRequest++
    voteRequests.set(roomId, (voteRequests.get(roomId) ?? 0) + 1)
    voteLoading.value[roomId] = false
    try {
      await action()
      if (version !== revision) return false
      await loadVotes(roomId)
      return version === revision
    } catch (failure) {
      if (version === revision) {
        if (failure.status === 409 || failure.status === 403) await loadVotes(roomId, { quiet: true })
        voteErrors.value[roomId] = failure.message
      }
      return false
    } finally { if (version === revision) { busy.value = false; voteSaving.value[roomId] = false } }
  }
  // My section for the room (each member picks their own); null stops sharing it
  const confirmSection = (roomId, sectionId) =>
    roomAction(roomId, () => (sectionId ? api.setMySection(roomId, sectionId) : api.clearMySection(roomId)))
  // Owner only: removes the member and stops them rejoining with the code
  const removeMember = (roomId, memberId) => roomAction(roomId, () => api.banRoomMember(roomId, memberId))

  function setMyVotes(roomId, sectionIds) {
    myVotes.value[roomId] = sectionIds
    delete accepted.value[roomId]
  }

  // Take the signed-in student's picks back (and the bids they suggested for those sections)
  async function clearMyVotes(roomId) {
    await api.clearVotes(roomId)
    myVotes.value[roomId] = []
    delete accepted.value[roomId]
    Object.values(getRoom(roomId)?.suggestedBids ?? {}).forEach((bids) => delete bids[ME])
    await loadVotes(roomId)
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
    rooms, loading, busy, online, error, load, joinRoom,
    voteBoards, voteLoading, voteSaving, voteErrors, loadVotes, saveRoomVotes,
    myVotes, confirmSection, removeMember,
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
