import { defineStore } from 'pinia'
import { ref } from 'vue'
import { classmates, rooms as sampleRooms, roomPrereqs } from '../data/rooms'

export const MAX_ROOM_SIZE = 8

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
    if (id === 'me') return { id: 'me', name: 'You', short: 'You', initials: 'VS', you: true }
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
      members: ['me', ...members],
      votes: { [`${module}-G1`]: [], [`${module}-G2`]: [], [`${module}-G3`]: [] },
      finalised: null,
    })
    return id
  }

  function leaveRoom(id) {
    rooms.value = rooms.value.filter((r) => r.id !== id)
  }

  function setMyVotes(roomId, sectionIds) {
    myVotes.value[roomId] = sectionIds
  }

  function finalise(roomId, sectionId) {
    getRoom(roomId).finalised = sectionId
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
    finalise,
    importPlans,
  }
})
