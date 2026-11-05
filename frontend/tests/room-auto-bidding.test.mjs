import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('a section the party admin locked enters matching-term bidding for every member, preserving votes and degree plans', async () => {
  globalThis.localStorage = { getItem: key => key === 'bidmaxxer:dropped:a' ? JSON.stringify({ p1: ['IS216'] }) : null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { useRoomsStore } = await server.ssrLoadModule('/src/core/stores/rooms.js')
    const { useBiddingStore } = await server.ssrLoadModule('/src/core/stores/bidding.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true; user.profile = { _id: 'a', email: 'a@smu.edu.sg' }
    const planner = usePlannerStore()
    planner.plans = ['p1', 'p2'].map(id => ({ id, name: id, currentSem: 'Y2S1', semesters: [{ id: 'Y2S1', modules: [] }, { id: 'Y2S2', modules: [] }] }))
    planner.activePlanId = 'p1'; planner.online = true
    const originalPlans = JSON.stringify(planner.plans), term = '2026-27_T2'
    const g1 = { id: `${term}:IS216:G1`, module: 'IS216', section: 'G1', sessions: [] }
    const g2 = { ...g1, id: `${term}:IS216:G2`, section: 'G2' }
    // I am a member here; b is the party admin and locked G2
    const room = { _id: 'r', module: 'IS216', name: 'Friends', termKey: term, owner: 'b', members: [{ _id: 'a', name: 'A' }, { _id: 'b', name: 'B' }], votes: [{ user: 'a', sectionIds: [g1.id, g2.id] }, { user: 'b', sectionIds: [g2.id] }], locked: true, lockedSection: g2.id, memberSections: [] }
    // An old personal pick in a room nobody locked no longer reaches bidding
    const unlocked = { ...room, _id: 'other', module: 'IS112', locked: false, lockedSection: null, memberSections: [{ user: 'a', sectionId: `${term}:IS112:G1` }] }
    let listed = [room, unlocked]
    api.rooms = async () => listed
    api.room = async () => room
    api.roomSections = async () => [g1, g2].map(section => ({ section, voters: [] }))
    api.round = async () => ({ term })
    api.sections = async codes => codes.includes('IS216') ? [g1, g2] : []
    api.bidHistory = async () => []; api.weightage = async () => []; api.cart = async () => ({ items: [] })
    let saved
    api.saveCart = async payload => { saved = payload }
    const rooms = useRoomsStore(); await rooms.load()
    const bidding = useBiddingStore(); await bidding.load()
    assert.equal(bidding.booked.IS216, g2.id, 'the locked section reaches a member who is not the party admin, even if previously dropped')
    assert.equal(bidding.booked.IS112, undefined, 'a room that is not locked adds nothing')
    assert.equal(bidding.isLocked('IS216'), true)
    bidding.dropModule('IS216')
    assert.equal(bidding.booked.IS216, g2.id, 'a member cannot drop it')
    bidding.swapSection('IS216', g1.id)
    assert.equal(bidding.booked.IS216, g2.id, 'or swap it')
    assert.equal(await bidding.save(), true)
    assert.deepEqual(saved.items, [{ module: 'IS216', sectionId: g2.id, amount: 10 }])

    // The party admin unlocks, and it leaves bidding on the next refresh
    await rooms.loadVotes('r')
    api.unlockRoom = async (id) => { assert.equal(id, 'r'); room.locked = false; room.lockedSection = null }
    assert.equal(await rooms.unlockRoom('r'), true)
    assert.equal(bidding.booked.IS216, undefined, 'unlocking removes the room-only module')
    assert.deepEqual(room.votes.map(v => v.user), ['a', 'b'], 'unlocking keeps the votes')

    // Locked again on another section
    room.votes = [{ user: 'a', sectionIds: [g1.id] }, { user: 'b', sectionIds: [g1.id] }]
    await rooms.loadVotes('r')
    api.lockRoom = async (id, sectionId) => { assert.equal(id, 'r'); room.locked = true; room.lockedSection = sectionId }
    assert.equal(await rooms.lockRoom('r', g1.id), true)
    assert.equal(bidding.booked.IS216, g1.id)

    room.termKey = '2025-26_T2'
    await rooms.load()
    assert.equal(bidding.booked.IS216, undefined, 'old room terms cannot leak into bidding')
    room.termKey = term
    listed = [room, unlocked, { ...room, _id: 'conflicting', lockedSection: g2.id }]
    await rooms.load()
    assert.deepEqual([...bidding.roomConflicts], ['IS216'], 'two rooms locking different sections must not silently override each other')
    assert.equal(await bidding.save(), false)
    assert.match(bidding.saveError, /different sections.*rooms/i)
    assert.equal(JSON.stringify(planner.plans), originalPlans)
    user.uid = 'new-user'
    assert.deepEqual(bidding.booked, {}, 'room sections clear on account changes')
  } finally { await server.close() }
})
