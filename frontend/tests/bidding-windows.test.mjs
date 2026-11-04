import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

test('every window of the term is listed in order and marked closed, open or upcoming in Singapore time', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  try {
    const { windowsFor } = await server.ssrLoadModule('/src/core/utils/biddingWindows.js')
    const { BIDDING_WINDOWS } = await server.ssrLoadModule('/src/core/data/biddingWindows.js')
    const term = '2026-27_T2'
    // 4 Nov 2026, 11:00 Singapore: 1A window 2 has just closed (10:00) and window 3 opens at 17:00
    const list = windowsFor(term, Date.parse('2026-11-04T03:00:00Z'))
    assert.equal(list.length, BIDDING_WINDOWS.filter(w => w.term === term).length, 'finished windows are listed too')
    assert.deepEqual(list.slice(0, 3).map(w => w.state), ['closed', 'closed', 'upcoming'])
    assert.equal(list[0].name, 'Round 1A · Window 1')
    assert.equal(list[0].when, 'Closed Mon 2 Nov, 10:00')
    assert.equal(list[2].when, 'Opens Wed 4 Nov, 17:00')
    assert.equal(list[2].inferred, true)
    const during = windowsFor(term, Date.parse('2026-11-03T03:00:00Z'))
    assert.deepEqual(during.filter(w => w.state === 'open').map(w => w.name), ['Round 1A · Window 2'])
    assert.equal(during.find(w => w.state === 'open').when, 'Closes Wed 4 Nov, 10:00')
    assert.deepEqual(windowsFor('2099-00_T9', Date.now()), [], 'a term without listed windows gives nothing, so the dashboard falls back to the open round')
  } finally { await server.close() }
})
