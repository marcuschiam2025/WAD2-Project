import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { renderToString } from 'vue/server-renderer'

test('dashboard planned meetings respect teaching dates and Singapore time', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { plannedMeetings, singaporeDay } = await server.ssrLoadModule('/src/core/utils/dashboardSchedule.js')
    const section = { id: 'current', module: 'IS216', section: 'G1', startDate: '2026-10-26', endDate: '2026-11-01', sessions: [{ day: 0, start: '10:00', end: '11:30' }, { day: 2, start: '12:00', end: '15:15' }] }
    const now = new Date('2026-10-26T01:00:00Z') // Monday 09:00 in Singapore
    const meetings = plannedMeetings([section], now)
    assert.deepEqual(meetings.map(m => [m.offset, m.time, m.kind]), [[0, '10:00', 'Planned class'], [2, '12:00', 'Planned class']])
    assert.equal(new Set(meetings.map(m => m.id)).size, 2)
    for (const other of [
      { ...section, startDate: '2027-01-11', endDate: '2027-04-18' },
      { ...section, startDate: '2026-08-01', endDate: '2026-10-25' },
      { ...section, startDate: null },
      { ...section, startDate: '2026-02-30' },
      { ...section, startDate: '2026-11-01', endDate: '2026-10-26' },
    ]) assert.deepEqual(plannedMeetings([other], now), [])
    assert.deepEqual(plannedMeetings([{ ...section, endDate: '2026-10-26' }], now).map(m => m.offset), [0], 'inclusive last teaching date')
    assert.deepEqual(plannedMeetings([section], new Date('2026-10-26T03:30:00Z')).map(m => m.offset), [2], 'ended meetings are removed')
    assert.deepEqual(plannedMeetings([section], new Date('2026-10-26T02:30:00Z')).map(m => m.offset), [0, 2], 'ongoing meetings remain')
    const sunday = { ...section, sessions: [{ day: 6, start: '10:00', end: '11:30' }] }
    assert.deepEqual(plannedMeetings([sunday], now).map(m => m.offset), [6])
    assert.deepEqual(plannedMeetings([{ ...section, sessions: [] }], now), [])
    assert.deepEqual(plannedMeetings([{ ...section, sessions: [{ day: 0, start: '25:00', end: '26:00' }] }], now), [])
    assert.equal(singaporeDay(new Date('2026-10-25T17:00:00Z')).toISOString(), '2026-10-26T00:00:00.000Z', 'browser timezone cannot move a Singapore class to Sunday')
    assert.deepEqual(plannedMeetings([section], new Date('2026-10-25T17:00:00Z')).map(m => m.offset), [0, 2])
  } finally { await server.close() }
})

test('dashboard labels the schedule as planned and omits an expired bidding deadline', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: Dashboard } = await server.ssrLoadModule('/src/views/DashboardView.vue')
    const { useBiddingStore } = await server.ssrLoadModule('/src/core/stores/bidding.js')
    const pinia = createPinia(); setActivePinia(pinia)
    useBiddingStore().round = { round: '1', term: '2020-21_T1', closesAt: '2020-01-01T00:00:00Z' }
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Dashboard }, ...['/bidding/finalised', '/quiz', '/planner', '/bidding'].map(path => ({ path, component: { render: () => null } }))] })
    await router.push('/')
    const app = createSSRApp(Dashboard).use(pinia).use(router)
    app.directive('enter', { getSSRProps: () => ({}) })
    app.directive('stagger', { getSSRProps: () => ({}) })
    const html = await renderToString(app)
    assert.match(html, /Singapore time/)
    assert.match(html, /do not confirm enrolment/)
    assert.match(html, /Next 7 days/)
    assert.match(html, /Closed/)
    assert.doesNotMatch(html, /Submit bid cart/)
  } finally { await server.close() }
})
