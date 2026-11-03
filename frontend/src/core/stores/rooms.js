import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { api } from '../services/api'
import { useUserStore } from './user'
import { buildRoomBoard } from '../utils/roomBoard'

const ME = 'me'

// owner > admin > member
export function roleOf(room, id) {
  if (room.ownerId === id) return 'owner'
  return room.admins.includes(id) ? 'admin' : 'member'
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

  const user = useUserStore()
  watch(() => user.uid, () => {
    revision++; listRequest++
    voteBoards.value = {}; voteLoading.value = {}; voteSaving.value = {}; voteErrors.value = {}; voteRequests.clear()
    people.value = {}; loading.value = false; busy.value = false; online.value = false; error.value = ''
    rooms.value = []
    myVotes.value = {}
  }, { flush: 'sync' })

  // Where a room stands. Once everyone has voted, the section(s) with the most votes can be accepted.
  // Several sections on the same top count is a tie: the student accepts exactly one of them.
  function roomState(room) {
    const board = voteBoards.value[room?.id] ?? room?.summary ?? {}
    return { ...board, voted: board.votedCount ?? 0, total: board.memberCount ?? room?.members.length ?? 0,
      waiting: board.waitingIds ?? [], leaders: board.leaders ?? [], acceptedId: board.finalisedSection ?? null }
  }

  // Keep degree-plan automation inactive. Only my personal section feeds bidding.
  const decided = computed(() => [])
  const pickedForBidding = computed(() => rooms.value.flatMap(room => room.mySectionId
    ? [{ roomId: room.id, roomName: room.name, module: room.module, term: room.term, sectionId: room.mySectionId }]
    : []))

  function getRoom(id) {
    return rooms.value.find((r) => r.id === id)
  }

  function person(id) {
    if (id === ME) return { id: ME, name: 'You', short: 'You', initials: user.profile.initials || 'You', you: true }
    return people.value[id] ?? { id, name: 'Member', short: 'Member', initials: '?', you: false }
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
      admins: [], members, votes, term: party.termKey, summary: party.summary, updatedAt: party.updatedAt,
      sharedSections: Object.fromEntries((party.memberSections ?? []).map(entry => [memberId(entry.user), entry.sectionId])),
      mySectionId: party.memberSections?.find(entry => memberId(entry.user) === ME)?.sectionId ?? null }
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
    delete myVotes.value[id]
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
        room.mySectionId = board.finalisedSection
        room.sharedSections = Object.fromEntries(board.rows.flatMap(row => row.goingFor.map(entry => [entry._id === String(user.profile._id) ? ME : entry._id, row.section.id])))
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

  return {
    rooms, loading, busy, online, error, load, joinRoom,
    voteBoards, voteLoading, voteSaving, voteErrors, loadVotes, saveRoomVotes,
    myVotes, confirmSection, removeMember,
    decided, pickedForBidding,
    roomState,
    getRoom,
    person,
    createRoom,
    leaveRoom,
  }
})

// Dev only: lets Vite swap this store's code in when the file is edited, instead of keeping the old store
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useRoomsStore, import.meta.hot))
