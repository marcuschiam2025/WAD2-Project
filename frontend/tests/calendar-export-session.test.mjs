import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
test('calendar exports stop before posting after identity changes and ignore stale results', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useCalendarExportStore } = await server.ssrLoadModule('/src/core/stores/calendarExport.js')
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { useBiddingStore } = await server.ssrLoadModule('/src/core/stores/bidding.js')
    const { authClient } = await server.ssrLoadModule('/src/core/services/firebase.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true
    const bidding = useBiddingStore(); bidding.round.term = '2026-27_T2'
    const calendar = useCalendarExportStore()
    const copy = { id: 'c', name: 'Plan 1', items: [{ section: { id: 's', module: 'IS216', section: 'G1', startDate: '2027-01-11', endDate: '2027-04-18', sessions: [{ day: 0, start: '10:00', end: '11:30' }] } }] }
    let popup = deferred(), posts = 0, forgets = 0
    authClient.calendarAccessToken = () => popup.promise
    authClient.forgetCalendarToken = () => { forgets++ }
    api.exportCalendar = async () => { posts++; return { created: 1 } }
    const first = calendar.addToGoogle(copy, '', 13)
    assert.equal(calendar.adding, 'c')
    await calendar.addToGoogle(copy, '', 13)
    user.uid = 'b'
    popup.resolve('old-token'); assert.equal(await first, false)
    assert.equal(posts, 0)
    assert.equal(calendar.message, ''); assert.equal(calendar.error, ''); assert.equal(calendar.adding, null)

    bidding.round.term = '2026-27_T2'
    popup = deferred()
    const second = calendar.addToGoogle(copy, '', 13)
    popup.resolve('token'); await Promise.resolve(); await Promise.resolve()
    assert.equal(await second, true); assert.equal(posts, 1)
    assert.match(calendar.message, /Added 1 weekly class series/)

    const response = deferred(); api.exportCalendar = () => { posts++; return response.promise }
    const late = calendar.addToGoogle(copy, '', 13)
    await Promise.resolve(); await Promise.resolve()
    bidding.round.term = '2027-28_T1'
    response.reject(new Error('permission not granted'))
    assert.equal(await late, false)
    assert.equal(calendar.message, ''); assert.equal(calendar.error, '')
    assert.equal(forgets, 0, 'old errors must not revoke the new session token')

    let popups = 0; authClient.calendarAccessToken = async () => { popups++; return 'token' }
    const undated = { ...copy, items: [{ section: { ...copy.items[0].section, startDate: null, endDate: null } }] }
    assert.equal(await calendar.addToGoogle(undated, '2027-01-12', 13), false)
    assert.match(calendar.error, /Monday/); assert.equal(popups, 0)
    assert.equal(await calendar.addToGoogle(undated, '2027-01-11', 0), false)
    assert.equal(popups, 0)
    const cancelled = calendar.addToGoogle(copy, '', 13)
    calendar.cancel(); assert.equal(await cancelled, false)
  } finally { await server.close() }
})
