import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('only my saved memberSections pick enters matching-term bidding, preserving votes and degree plans', async () => {
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
    const room = { _id: 'r', module: 'IS216', name: 'Friends', termKey: term, owner: 'b', members: [{ _id: 'a', name: 'A' }, { _id: 'b', name: 'B' }], votes: [{ user: 'a', sectionIds: [g1.id] }], memberSections: [{ user: { _id: 'b' }, sectionId: g1.id, status: 'bidding' }, { user: { _id: 'a' }, sectionId: g2.id, status: 'considering' }] }
    const otherOnly = { ...room, _id: 'other', module: 'IS112', memberSections: [{ user: 'b', sectionId: `${term}:IS112:G1` }] }
    let listed = [room, otherOnly]
    api.rooms = async () => listed
    api.room = async () => room
    api.roomSections = async () => [g1, g2].map(section => ({ section, voters: [], goingFor: [] }))
    api.round = async () => ({ term })
    api.sections = async codes => codes.includes('IS216') ? [g1, g2] : []
    api.bidHistory = async () => []; api.weightage = async () => []; api.cart = async () => ({ items: [] })
    let saved
    api.saveCart = async payload => { saved = payload }
    const rooms = useRoomsStore(); await rooms.load()
    const bidding = useBiddingStore(); await bidding.load()
    assert.equal(bidding.booked.IS216, g2.id, 'reload reads my personal saved pick, even if previously dropped')
    assert.equal(bidding.booked.IS112, undefined, 'other members cannot select modules for me')
    assert.equal(bidding.isLocked('IS216'), true)
    bidding.dropModule('IS216')
    assert.equal(bidding.booked.IS216, g2.id)
    assert.deepEqual([...rooms.decided], [], 'the degree-plan automation remains inactive')
    assert.equal(await bidding.save(), true)
    assert.deepEqual(saved.items, [{ module: 'IS216', sectionId: g2.id, amount: 10 }])
    await rooms.loadVotes('r')
    api.setMySection = async (id, sectionId) => { assert.equal(id, 'r'); room.memberSections[1].sectionId = sectionId }
    assert.equal(await rooms.confirmSection('r', g1.id), true, 'use the group my-section endpoint')
    assert.equal(bidding.booked.IS216, g1.id)
    assert.deepEqual(room.votes, [{ user: 'a', sectionIds: [g1.id] }], 'sharing a section does not edit votes')
    api.clearMySection = async () => { room.memberSections = room.memberSections.filter(entry => entry.user._id !== 'a') }
    assert.equal(await rooms.confirmSection('r', null), true)
    assert.equal(bidding.booked.IS216, undefined, 'stopping my share removes the automatic-only module')
    room.memberSections.push({ user: 'a', sectionId: g2.id }); room.termKey = '2025-26_T2'
    await rooms.load()
    assert.equal(bidding.booked.IS216, undefined, 'old room terms cannot leak into bidding')
    room.termKey = term
    listed = [room, otherOnly, { ...room, _id: 'conflicting', memberSections: [{ user: 'a', sectionId: g1.id }] }]
    await rooms.load()
    assert.deepEqual([...bidding.roomConflicts], ['IS216'], 'different personal picks must not silently override each other')
    assert.equal(await bidding.save(), false)
    assert.match(bidding.saveError, /different sections.*rooms/i)
    assert.equal(JSON.stringify(planner.plans), originalPlans)
    user.uid = 'new-user'
    assert.deepEqual(bidding.booked, {}, 'personal section choices clear on account changes')
  } finally { await server.close() }
})
