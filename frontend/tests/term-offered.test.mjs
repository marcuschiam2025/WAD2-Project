import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

async function setup(semesters) {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
  const { liveModules } = await server.ssrLoadModule('/src/core/data/catalogue.js')
  setActivePinia(createPinia())
  const planner = usePlannerStore()
  planner.plans = [{ id: 'p', name: 'Plan 1', tracks: [], currentSem: 'Y1S1', semesters }]
  planner.activePlanId = 'p'
  Object.assign(liveModules, {
    T1ONLY: { code: 'T1ONLY', termsOffered: ['T1'] },
    T2ONLY: { code: 'T2ONLY', termsOffered: ['T2'] },
    BOTH: { code: 'BOTH', termsOffered: ['T1', 'T2'] },
    UNKNOWN: { code: 'UNKNOWN', termsOffered: [] },
  })
  return { server, planner, plan: planner.plans[0] }
}
const sem = (id, extra = {}) => ({ id, label: id, exchange: false, loa: false, modules: [], ...extra })

test('a one-term module is refused in the other term and pointed at the next semester that offers it', async () => {
  const { server, planner, plan } = await setup([sem('Y1S1'), sem('Y1S2'), sem('Y2S1'), sem('Y2S2')])
  try {
    const blocked = planner.termBlock(plan, 'T2ONLY', 'Y1S1')
    assert.deepEqual(blocked.terms, ['T2'])
    assert.equal(blocked.next.id, 'Y1S2')
    assert.equal(planner.termBlock(plan, 'T2ONLY', 'Y1S2'), null, 'Term 2 semester is fine')
    assert.equal(planner.termBlock(plan, 'T2ONLY', 'Y2S2'), null)
    assert.equal(planner.termBlock(plan, 'T1ONLY', 'Y1S2').next.id, 'Y2S1')
    assert.equal(planner.termBlock(plan, 'T1ONLY', 'Y1S1'), null)
    assert.equal(planner.termBlock(plan, 'BOTH', 'Y1S1'), null, 'offered in both terms')
    assert.equal(planner.termBlock(plan, 'UNKNOWN', 'Y1S1'), null, 'terms unknown: allowed, nothing to check against')
    assert.equal(planner.termBlock(plan, 'NOT-IN-CATALOGUE', 'Y1S1'), null)
  } finally { await server.close() }
})

test('the next semester skips LOA and exchange terms, and is null when the plan has none', async () => {
  const { server, planner, plan } = await setup([sem('Y1S1'), sem('Y1S2', { loa: true }), sem('Y2S1'), sem('Y2S2', { exchange: true }), sem('Y3S1')])
  try {
    assert.equal(planner.termBlock(plan, 'T1ONLY', 'Y1S2').next.id, 'Y2S1')
    assert.equal(planner.termBlock(plan, 'T2ONLY', 'Y1S1').next, null, 'only an LOA and an exchange term offer Term 2')
    assert.equal(planner.termBlock(plan, 'T2ONLY', 'Y2S1').next, null)
    assert.equal(planner.termBlock(plan, 'T2ONLY', 'Y2S2'), null, 'an exchange semester is not checked')
  } finally { await server.close() }
})
