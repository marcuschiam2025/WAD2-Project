import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { api } from '../services/api'
import { useUserStore } from './user'
import { buildRoomBoard, lockableSections } from '../utils/roomBoard'

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

  // Where a room stands. Once everyone has voted, the party admin can lock one of the sections with the most votes.
  // Several sections on the same top count is a tie: the party admin locks exactly one of them.
  function roomState(room) {
    const board = voteBoards.value[room?.id] ?? room?.summary ?? {}
    return { ...board, voted: board.votedCount ?? 0, total: board.memberCount ?? room?.members.length ?? 0,
      waiting: board.waitingIds ?? [], leaders: board.leaders ?? [], lockedId: room?.lockedSection ?? null }
  }

  // Keep degree-plan automation inactive. Only a section the party admin locked feeds bidding, for every member.
  const decided = computed(() => [])
  const pickedForBidding = computed(() => rooms.value.flatMap(room => room.lockedSection
    ? [{ roomId: room.id, roomName: room.name, module: room.module, term: room.term, sectionId: room.lockedSection }]
    : []))
  // A locked section is everyone's: the bidding and planner cards show the whole party on it
  const everyoneOn = (members, sectionId) => (sectionId ? Object.fromEntries(members.map(id => [id, sectionId])) : {})

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
    const lockedSection = party.locked ? party.lockedSection ?? null : null
    // Vote counts for the room list and dashboard. Opening the room replaces this with the full board.
    const voted = new Set((party.votes ?? []).filter(ballot => ballot.sectionIds.length).map(ballot => memberId(ballot.user)))
    const votedCount = members.filter(id => voted.has(id)).length
    const allVoted = members.length > 0 && votedCount === members.length
    const summary = party.votes
      ? { memberCount: members.length, votedCount, allVoted, status: party.locked ? 'locked' : allVoted ? 'ready' : 'voting' }
      : party.summary
    return { id: String(party._id), name: party.name, description: party.description, module: party.module,
      inviteCode: party.inviteCode, maxMembers: party.maxMembers, ownerId: memberId(party.owner),
      admins: [], members, votes, term: party.termKey, summary, updatedAt: party.updatedAt,
      locked: !!party.locked, lockedSection, sharedSections: everyoneOn(members, lockedSection) }
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
      // TODO(backend): GET /parties leaves out locked, lockedSection, owner and votes, so read each room in full.
      // If one read fails, keep what we knew about its lock so its module doesn't drop out of bidding for a moment.
      const full = await Promise.all(data.map(party => party.locked !== undefined ? party : api.room(party._id).catch(() => {
        const known = getRoom(String(party._id))
        return { ...party, locked: known?.locked, lockedSection: known?.lockedSection }
      })))
      if (version !== revision || request !== listRequest) return
      rooms.value = full.map(normalize)
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
        room.locked = board.locked
        room.lockedSection = board.lockedSection
        room.term = board.term
        if (board.ownerId) room.ownerId = board.ownerId === String(user.profile._id) ? ME : board.ownerId
        if (board.members) room.members = board.members.map(member => {
          const id = member._id === String(user.profile._id) ? ME : member._id
          people.value[id] = { id, name: member.name, short: member.name, initials: member.name.split(/\s+/).slice(0,2).map(word => word[0]).join('').toUpperCase(), you: id === ME }
          return id
        })
        room.sharedSections = everyoneOn(room.members, board.lockedSection)
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
        if (failure.status === 400 || failure.status === 409 || failure.status === 403) await loadVotes(roomId, { quiet: true })
        voteErrors.value[roomId] = failure.message
      }
      return false
    } finally { if (version === revision) { busy.value = false; voteSaving.value[roomId] = false } }
  }
  // TODO(backend): the lock is saved before the notifications are sent, so a failed notification reports an error for a
  // lock that did happen. Unless the server refused the request (4xx), the room's real state decides whether it worked.
  async function settleLock(roomId, request, happened) {
    try { await request() } catch (failure) {
      if (failure.status >= 400 && failure.status < 500) throw failure
      const party = await api.room(roomId).catch(() => null)
      if (!party || !happened(party)) throw failure
    }
  }
  // Party admin only: locks one section for the whole room. Someone may have changed their vote since this page last
  // refreshed, so the rule is checked against the latest votes first. A 409 reloads the board for the admin to see.
  const lockRoom = (roomId, sectionId) => roomAction(roomId, async () => {
    const [party, summary] = await Promise.all([api.room(roomId), api.roomSections(roomId)])
    const latest = buildRoomBoard(party, summary, String(user.profile._id ?? ''))
    if (!lockableSections(latest).includes(sectionId)) {
      throw Object.assign(new Error('The votes have changed, so this section can no longer be locked. Check the results and try again.'), { status: 409 })
    }
    await settleLock(roomId, () => api.lockRoom(roomId, sectionId), (party) => party.locked && party.lockedSection === sectionId)
  })
  // Party admin only: votes reopen and the section comes out of everyone's bidding
  const unlockRoom = (roomId) => roomAction(roomId, () => settleLock(roomId, () => api.unlockRoom(roomId), (party) => !party.locked))
  // Owner only: removes the member and stops them rejoining with the code
  const removeMember = (roomId, memberId) => roomAction(roomId, () => api.banRoomMember(roomId, memberId))
  // Party admin only: hands the role to another member, who can then lock, unlock and manage members.
  // TODO(backend): needs PUT /api/parties/:id/owner { userId }. Until it exists the server answers 404.
  const transferAdmin = (roomId, memberId) => roomAction(roomId, () => api.transferRoomAdmin(roomId, memberId).catch((failure) => {
    throw failure.status === 404 ? new Error('Handing over the party admin role isn\'t available yet.') : failure
  }))

  return {
    rooms, loading, busy, online, error, load, joinRoom,
    voteBoards, voteLoading, voteSaving, voteErrors, loadVotes, saveRoomVotes,
    myVotes, lockRoom, unlockRoom, removeMember, transferAdmin,
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
