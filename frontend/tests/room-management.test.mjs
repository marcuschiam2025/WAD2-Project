import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { renderToString } from 'vue/server-renderer'

const member = (id) => ({ _id: id, name: id.toUpperCase() })
const sections = [{ section: { id: 'g1', section: 'G1', module: 'IS216', sessions: [] }, voters: [] }, { section: { id: 'g2', section: 'G2', module: 'IS216', sessions: [] }, voters: [] }]

test('the board only offers a lock once everyone has voted, and only on the sections with the most votes', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  try {
    const { buildRoomBoard, lockableSections } = await server.ssrLoadModule('/src/core/utils/roomBoard.js')
    const board = (votes, extra = {}) => buildRoomBoard({ termKey: 't', owner: 'a', members: [member('a'), member('b')], votes: Object.entries(votes).map(([user, sectionIds]) => ({ user, sectionIds })), ...extra }, sections, 'a')
    assert.deepEqual(lockableSections(board({})), [], 'nobody has voted')
    assert.deepEqual(lockableSections(board({ a: ['g1'] })), [], 'one member has not voted')
    assert.deepEqual(lockableSections(board({ a: ['g1'], b: ['g1', 'g2'] })), ['g1'], 'a clear winner: the runner-up cannot be locked')
    assert.deepEqual(lockableSections(board({ a: ['g1'], b: ['g2'] })), ['g1', 'g2'], 'a tie: either leader can be locked')
    const locked = board({ a: ['g1'], b: ['g1'] }, { locked: true, lockedSection: 'g1' })
    assert.equal(locked.lockedSection, 'g1')
    assert.equal(locked.status, 'locked')
    assert.deepEqual(lockableSections(locked), [], 'already locked')
    assert.equal(board({ a: ['g1'] }, { locked: false, lockedSection: 'g2' }).lockedSection, null, 'a stale section on an unlocked room does not count')
  } finally { await server.close() }
})

test('locking applies to the whole room, rechecks the latest votes, and unlocking reopens it', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { useRoomsStore } = await server.ssrLoadModule('/src/core/stores/rooms.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true; user.profile = { _id: 'a', email: 'a@smu.edu.sg' }
    const rooms = useRoomsStore()
    rooms.rooms = [{ id: 'r', name: 'Friends', members: ['me', 'b'], ownerId: 'me', admins: [], module: 'IS216', term: 't' }]
    let members = [member('a'), member('b')], votes = [{ user: 'a', sectionIds: ['g1'] }], locked = false, lockedSection = null
    const calls = []
    api.room = async () => ({ _id: 'r', termKey: 't', owner: 'a', members, votes, locked, lockedSection })
    api.roomSections = async () => sections
    api.lockRoom = async (id, sectionId) => { calls.push(['lock', id, sectionId]); locked = true; lockedSection = sectionId }
    api.unlockRoom = async (id) => { calls.push(['unlock', id]); locked = false; lockedSection = null }
    await rooms.loadVotes('r')

    assert.equal(await rooms.lockRoom('r', 'g1'), false, 'b has not voted yet')
    assert.match(rooms.voteErrors.r, /votes have changed/)
    assert.deepEqual(calls, [], 'the server is never asked')

    votes = [{ user: 'a', sectionIds: ['g1'] }, { user: 'b', sectionIds: ['g1', 'g2'] }]
    await rooms.loadVotes('r')
    assert.equal(await rooms.lockRoom('r', 'g2'), false, 'g2 does not have the most votes')
    assert.deepEqual(calls, [])

    // The page still shows g1 and g2 tied, but b changed their vote after the last refresh
    votes = [{ user: 'a', sectionIds: ['g1', 'g2'] }, { user: 'b', sectionIds: ['g1', 'g2'] }]
    await rooms.loadVotes('r')
    votes = [{ user: 'a', sectionIds: ['g1', 'g2'] }, { user: 'b', sectionIds: ['g1'] }]
    assert.equal(await rooms.lockRoom('r', 'g2'), false, 'checked against the latest votes, not the ones on screen')
    assert.deepEqual(calls, [])
    assert.deepEqual([...rooms.voteBoards.r.leaders], ['g1'], 'and the board refreshes to show why')

    assert.equal(await rooms.lockRoom('r', 'g1'), true)
    assert.deepEqual(calls, [['lock', 'r', 'g1']])
    assert.equal(rooms.voteBoards.r.lockedSection, 'g1')
    assert.equal(rooms.getRoom('r').lockedSection, 'g1')
    assert.deepEqual(rooms.pickedForBidding.map((d) => [d.roomId, d.module, d.sectionId]), [['r', 'IS216', 'g1']], 'it feeds bidding')
    assert.deepEqual({ ...rooms.getRoom('r').sharedSections }, { me: 'g1', b: 'g1' }, 'for every member')
    assert.equal(rooms.roomState(rooms.getRoom('r')).lockedId, 'g1')
    assert.deepEqual([...rooms.decided], [], 'a room section must not auto-edit personal plans')

    assert.equal(await rooms.unlockRoom('r'), true)
    assert.deepEqual(calls.at(-1), ['unlock', 'r'])
    assert.equal(rooms.voteBoards.r.locked, false)
    assert.deepEqual(rooms.pickedForBidding, [], 'it leaves bidding again')
    assert.deepEqual({ ...rooms.getRoom('r').sharedSections }, {})

    // The server saves the lock, then fails sending notifications: the lock did happen, so the room shows it
    votes = [{ user: 'a', sectionIds: ['g1'] }, { user: 'b', sectionIds: ['g1'] }]
    await rooms.loadVotes('r')
    const notificationFailure = () => Object.assign(Error('Notification validation failed'), { status: 500 })
    api.lockRoom = async (id, sectionId) => { locked = true; lockedSection = sectionId; throw notificationFailure() }
    assert.equal(await rooms.lockRoom('r', 'g1'), true)
    assert.equal(rooms.voteErrors.r, '')
    assert.equal(rooms.voteBoards.r.lockedSection, 'g1')
    api.unlockRoom = async () => { locked = false; lockedSection = null; throw notificationFailure() }
    assert.equal(await rooms.unlockRoom('r'), true)
    assert.equal(rooms.voteBoards.r.locked, false)
    // A 500 that did not change anything is still an error
    api.lockRoom = async () => { throw notificationFailure() }
    assert.equal(await rooms.lockRoom('r', 'g1'), false)
    assert.match(rooms.voteErrors.r, /Notification validation failed/)
    assert.equal(rooms.voteBoards.r.locked, false)

    // The server has the same rule. If votes move in the moment after the app's own check, its refusal refreshes the board
    votes = [{ user: 'a', sectionIds: ['g1'] }, { user: 'b', sectionIds: ['g1'] }]
    await rooms.loadVotes('r')
    api.lockRoom = async () => {
      votes = [{ user: 'a', sectionIds: ['g2'] }, { user: 'b', sectionIds: ['g2'] }]
      throw Object.assign(Error('Choose one of the leading sections: g2'), { status: 400 })
    }
    assert.equal(await rooms.lockRoom('r', 'g1'), false)
    assert.match(rooms.voteErrors.r, /leading sections/)
    assert.deepEqual([...rooms.voteBoards.r.leaders], ['g2'], 'the admin sees the new leader straight away')
    assert.equal(rooms.voteBoards.r.locked, false)

    // A failure from the server, such as a member who is not the party admin
    api.unlockRoom = async () => { throw Object.assign(Error('Only the party owner can do this'), { status: 403 }) }
    assert.equal(await rooms.unlockRoom('r'), false)
    assert.match(rooms.voteErrors.r, /party owner/)

    // Handing over the party admin role
    let owner = 'a'
    const roomBefore = api.room
    api.room = async () => ({ ...(await roomBefore()), owner })
    api.transferRoomAdmin = async () => { throw Object.assign(Error('Not found'), { status: 404 }) }
    assert.equal(await rooms.transferAdmin('r', 'b'), false)
    assert.match(rooms.voteErrors.r, /isn't available yet/, 'a clear message until the backend has the endpoint')
    assert.equal(rooms.getRoom('r').ownerId, 'me', 'and nothing changed')
    assert.notEqual(rooms.getRoom('r'), undefined, 'the 404 does not read as being removed from the room')
    api.transferRoomAdmin = async (id, target) => { assert.equal(id, 'r'); assert.equal(target, 'b'); owner = 'b' }
    assert.equal(await rooms.transferAdmin('r', 'b'), true)
    assert.equal(rooms.getRoom('r').ownerId, 'b')
    assert.equal(rooms.voteBoards.r.ownerId, 'b', 'I am a regular member now')
    api.transferRoomAdmin = async () => { throw Object.assign(Error('Only the party owner can do this'), { status: 403 }) }
    assert.equal(await rooms.transferAdmin('r', 'a'), false)
    assert.match(rooms.voteErrors.r, /party owner/)
    owner = 'a'
    await rooms.loadVotes('r')
    assert.equal(rooms.getRoom('r').ownerId, 'me')

    // POST /parties/:id/ban removes the member
    api.banRoomMember = async (id, target) => { assert.equal(target, 'b'); members = members.filter(m => m._id !== 'b') }
    assert.equal(await rooms.removeMember('r', 'b'), true)
    assert.deepEqual([...rooms.getRoom('r').members], ['me'])
    api.room = async () => { throw Object.assign(Error('Removed'), { status: 403 }) }
    await rooms.loadVotes('r')
    assert.equal(rooms.voteBoards.r, undefined)
    assert.equal(rooms.getRoom('r'), undefined)
  } finally { await server.close() }
})

test('the room list reads the lock from each room, because GET /parties leaves it out', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { useRoomsStore } = await server.ssrLoadModule('/src/core/stores/rooms.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true; user.profile = { _id: 'a', email: 'a@smu.edu.sg' }
    const rooms = useRoomsStore()
    const listed = { _id: 'r', name: 'Friends', module: 'IS216', termKey: 't', members: [member('a'), member('b')] }
    api.rooms = async () => [listed]
    api.room = async () => ({ ...listed, owner: 'b', votes: [{ user: 'a', sectionIds: ['g1'] }], locked: true, lockedSection: 'g1' })
    await rooms.load()
    assert.equal(rooms.getRoom('r').lockedSection, 'g1')
    assert.equal(rooms.getRoom('r').ownerId, 'b')
    assert.equal(rooms.roomState(rooms.getRoom('r')).voted, 1, 'vote counts come from the same read')
    assert.equal(rooms.roomState(rooms.getRoom('r')).total, 2)
    assert.equal(rooms.getRoom('r').summary.status, 'locked')
    assert.deepEqual(rooms.pickedForBidding.map((d) => d.sectionId), ['g1'])
    // One failed read keeps what we knew, so the module doesn't drop out of bidding for a moment
    api.room = async () => { throw Error('offline') }
    await rooms.load()
    assert.equal(rooms.getRoom('r').lockedSection, 'g1')
  } finally { await server.close() }
})

test('only the party admin sees lock and unlock buttons, on the right sections at the right time', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: RoomResults } = await server.ssrLoadModule('/src/components/rooms/RoomResults.vue')
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { useRoomsStore } = await server.ssrLoadModule('/src/core/stores/rooms.js')
    const { buildRoomBoard } = await server.ssrLoadModule('/src/core/utils/roomBoard.js')
    const render = async (me, votes, extra = {}) => {
      const pinia = createPinia(); setActivePinia(pinia)
      const user = useUserStore(); user.uid = me; user.isSignedIn = true; user.profile = { _id: me, email: `${me}@smu.edu.sg` }
      const rooms = useRoomsStore()
      rooms.rooms = [{ id: 'r', name: 'Friends', members: ['me', 'x'], ownerId: me === 'a' ? 'me' : 'a', admins: [], module: 'IS216', term: 't' }]
      rooms.voteBoards.r = buildRoomBoard({ termKey: 't', owner: 'a', members: [member('a'), member('b')], votes: Object.entries(votes).map(([u, sectionIds]) => ({ user: u, sectionIds })), ...extra }, sections, me)
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }, { path: '/bidding', component: { render: () => null } }] })
      await router.push('/')
      return renderToString(createSSRApp(RoomResults, { roomId: 'r' }).use(pinia).use(router))
    }
    const lockButtons = (html) => (html.match(/Lock this section/g) ?? []).length
    const winner = { a: ['g1'], b: ['g1', 'g2'] }, tie = { a: ['g1'], b: ['g2'] }, locked = { locked: true, lockedSection: 'g1' }

    // Before everyone has voted, nobody can lock
    let html = await render('a', { a: ['g1'] })
    assert.equal(lockButtons(html), 0)
    assert.match(html, /You can lock a section once everyone has voted/)
    assert.equal(lockButtons(await render('b', { a: ['g1'] })), 0)

    // Everyone has voted: the admin gets a button on the leader only, a member gets none
    html = await render('a', winner)
    assert.equal(lockButtons(html), 1)
    assert.match(html, /Lock the section with the most votes/)
    html = await render('b', winner)
    assert.equal(lockButtons(html), 0)
    assert.match(html, /Waiting for the party admin to lock the section/)

    // A tie: the admin chooses between the tied sections
    html = await render('a', tie)
    assert.equal(lockButtons(html), 2)
    assert.match(html, /Lock one of the tied sections/)
    assert.equal(lockButtons(await render('b', tie)), 0)

    // Locked: only the admin can unlock, and both see the section
    html = await render('a', winner, locked)
    assert.match(html, /Unlock room/)
    assert.equal(lockButtons(html), 0)
    assert.match(html, /You locked this section for everyone/)
    html = await render('b', winner, locked)
    assert.doesNotMatch(html, /Unlock room/)
    assert.equal(lockButtons(html), 0)
    assert.match(html, /The party admin locked this section for everyone/)
    assert.match(html, /Review bidding/, 'a locked section reaches every member')
    assert.doesNotMatch(html, /Pick this section|Your section/, 'members no longer pick their own section')
  } finally { await server.close() }
})
