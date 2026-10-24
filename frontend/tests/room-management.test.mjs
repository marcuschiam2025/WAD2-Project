import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('room confirmation/removal/transfer use persisted revisions without automatically changing personal plans', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { useRoomsStore } = await server.ssrLoadModule('/src/core/stores/rooms.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true; user.profile = { _id: 'a', email: 'a@smu.edu.sg' }
    const rooms = useRoomsStore()
    assert.equal(typeof rooms.confirmSection, 'function', 'persistent room decisions are required')
    rooms.rooms = [{ id: 'r', members: ['me', 'b'], ownerId: 'me', admins: [], module: 'IS216' }]
    let revision = 2, confirmed = null, owner = 'a'
    api.roomVotes = async () => ({ term: '2026-27_T1', revision, ownerId: owner, members: [{ _id: 'a', name: 'A' }, { _id: 'b', name: 'B' }], rows: [], mySectionIds: [], finalisedSection: confirmed, status: confirmed ? 'confirmed' : 'ready', votedCount: 2, memberCount: 2, waitingIds: [] })
    await rooms.loadVotes('r')
    api.confirmRoom = async (id, sectionId, expected) => { assert.equal(id, 'r'); assert.equal(expected, revision); revision++; confirmed = sectionId }
    assert.equal(await rooms.confirmSection('r', 'g1'), true)
    assert.equal(rooms.voteBoards.r.finalisedSection, 'g1')
    assert.deepEqual([...rooms.decided], [], 'shared confirmation must not auto-edit every personal plan')
    api.removeRoomMember = async (id, target, expected) => { assert.equal(target, 'b'); assert.equal(expected, revision); revision++; confirmed = null }
    assert.equal(await rooms.removeMember('r', 'b'), true)
    api.transferRoom = async (id, target, expected) => { assert.equal(target, 'b'); assert.equal(expected, revision); revision++; owner = 'b' }
    assert.equal(await rooms.transferOwner('r', 'b'), true)
    assert.equal(rooms.getRoom('r').ownerId, 'b')
    api.confirmRoom = async () => { throw Error('Room changed') }
    assert.equal(await rooms.confirmSection('r', 'g2'), false)
    assert.equal(rooms.voteErrors.r, 'Room changed')
    api.roomVotes = async () => { throw Object.assign(Error('Removed'), { status: 403 }) }
    await rooms.loadVotes('r')
    assert.equal(rooms.voteBoards.r, undefined)
    assert.equal(rooms.getRoom('r'), undefined)
  } finally { await server.close() }
})
