import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('each member picks their own section and the owner removes members, without changing personal plans', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { useRoomsStore } = await server.ssrLoadModule('/src/core/stores/rooms.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true; user.profile = { _id: 'a', email: 'a@smu.edu.sg' }
    const rooms = useRoomsStore()
    rooms.rooms = [{ id: 'r', members: ['me', 'b'], ownerId: 'me', admins: [], module: 'IS216' }]
    let members = [{ _id: 'a', name: 'A' }, { _id: 'b', name: 'B' }], mine = null
    api.room = async () => ({ _id: 'r', termKey: '2026-27_T1', owner: 'a', members, votes: [], memberSections: mine ? [{ user: { _id: 'a', name: 'A' }, sectionId: mine, status: 'considering' }] : [] })
    api.roomSections = async () => [{ section: { id: 'g1', section: 'G1' }, voteCount: 0, voters: [], goingFor: mine ? [{ user: { _id: 'a', name: 'A' }, status: 'considering' }] : [] }]
    await rooms.loadVotes('r')
    // PUT /parties/:id/my-section
    api.setMySection = async (id, sectionId) => { assert.equal(id, 'r'); mine = sectionId }
    assert.equal(await rooms.confirmSection('r', 'g1'), true)
    assert.equal(rooms.voteBoards.r.finalisedSection, 'g1')
    assert.equal(rooms.voteBoards.r.rows[0].goingFor[0].name, 'A')
    assert.deepEqual([...rooms.decided], [], 'a room section must not auto-edit personal plans')
    // DELETE /parties/:id/my-section
    api.clearMySection = async () => { mine = null }
    assert.equal(await rooms.confirmSection('r', null), true)
    assert.equal(rooms.voteBoards.r.finalisedSection, null)
    // POST /parties/:id/ban removes the member
    api.banRoomMember = async (id, target) => { assert.equal(target, 'b'); members = members.filter(m => m._id !== 'b') }
    assert.equal(await rooms.removeMember('r', 'b'), true)
    assert.deepEqual([...rooms.getRoom('r').members], ['me'])
    api.setMySection = async () => { throw Error('That section does not belong to IS216') }
    assert.equal(await rooms.confirmSection('r', 'g2'), false)
    assert.match(rooms.voteErrors.r, /does not belong/)
    api.room = async () => { throw Object.assign(Error('Removed'), { status: 403 }) }
    await rooms.loadVotes('r')
    assert.equal(rooms.voteBoards.r, undefined)
    assert.equal(rooms.getRoom('r'), undefined)
  } finally { await server.close() }
})
