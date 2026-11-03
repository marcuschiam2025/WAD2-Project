import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

const sems = ['Y1S1', 'Y1S2', 'Y2S1', 'Y2S2']
const plan = (id, tracks, y2s1) => ({ id, name: id, tracks, majorId: 'X', currentSem: 'Y2S1', semesters: sems.map((s) => ({ id: s, label: s, modules: s === 'Y1S1' ? ['IS111', 'IS113'] : s === 'Y2S1' ? y2s1 : s === 'Y2S2' ? ['IS213'] : [] })) })

async function setup(server) {
  const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
  const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
  const { api } = await server.ssrLoadModule('/src/core/services/api.js')
  setActivePinia(createPinia())
  const user = useUserStore(), planner = usePlannerStore()
  api.updateMe = async (c) => ({ email: 'a@smu.edu.sg', name: 'A', onboarded: true, ...c })
  api.updatePlan = async () => ({}); api.checkPlan = async () => ({})
  user.uid = 'a'; user.isSignedIn = true; user.onboarded = true
  user.profile.tracks = ['BA']; user.profile.takenBySem = { Y1S1: ['IS111', 'IS113'], Y2S1: ['IS212'] }
  planner.plans = [plan('p1', ['BA'], ['IS212', 'IS216', 'IS442']), plan('p2', [], ['IS212'])]; planner.activePlanId = 'p1'; planner.online = true
  return { user, planner }
}
const save = async (user, changes) => {
  await user.completeOnboarding({ tracks: ['BA'], currentSem: 'Y2S1', takenBySem: { Y1S1: ['IS111', 'IS113'], Y2S1: ['IS212'] }, ...changes })
  await nextTick(); await nextTick()
}

test('saving the profile keeps what was added in the planner and each plan\'s own tracks', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { user, planner } = await setup(server)
    await save(user, { exempted: ['COR1100'] })
    assert.deepEqual([...planner.plans[0].semesters[2].modules], ['IS212', 'IS216', 'IS442'], 'planner modules survive')
    assert.deepEqual([...planner.plans[0].tracks], ['BA'])
    assert.deepEqual([...planner.plans[1].tracks], [], '"Not decided" survives a profile edit that leaves tracks alone')
  } finally { await server.close() }
})

test('the profile still updates plans: removed, added and moved modules, and changed tracks', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { user, planner } = await setup(server)
    await save(user, { tracks: ['FT'], takenBySem: { Y1S1: ['IS111'], Y1S2: ['IS212'], Y2S1: ['IS115'] } })
    const [y1s1, y1s2, y2s1] = planner.plans[0].semesters
    assert.deepEqual([...y1s1.modules], ['IS111'], 'taken off the form')
    assert.deepEqual([...y1s2.modules], ['IS212'], 'moved to another semester')
    assert.deepEqual([...y2s1.modules], ['IS216', 'IS442', 'IS115'], 'added, and the planner\'s own stay')
    assert.deepEqual([...planner.plans[1].tracks], ['FT'])
  } finally { await server.close() }
})

test('only semesters added past the roadmap can be removed, and their modules go to the basket', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { planner } = await setup(server)
    assert.equal(planner.removableSemester, null, 'Y2S2 is part of the roadmap')
    planner.plans[0].semesters.push({ id: 'Y5S1', label: 'Y5 · S1', modules: ['IS999'] })
    assert.equal(planner.removableSemester.id, 'Y5S1')
    planner.removeSemester()
    assert.equal(planner.plans[0].semesters.at(-1).id, 'Y2S2')
    assert.ok(planner.basket.includes('IS999'))
  } finally { await server.close() }
})

test('display helpers: section codes, term labels and e$ amounts', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { sectionCode } = await server.ssrLoadModule('/src/core/utils/clash.js')
    const { termLabel } = await server.ssrLoadModule('/src/core/data/bidding.js')
    const { fmtE } = await server.ssrLoadModule('/src/core/utils/money.js')
    assert.equal(sectionCode('COR-MGMT1302-G1', 'COR-MGMT1302'), 'G1')
    assert.equal(sectionCode('IS442-G2', 'IS442'), 'G2')
    assert.equal(sectionCode('2026-27_T1:IS216:G1', 'IS216'), 'G1')
    assert.equal(termLabel('2026-27_T2'), 'AY26/27 T2')
    assert.equal(termLabel('AY26/27 T2'), 'AY26/27 T2')
    assert.equal(fmtE(151.1), '151.10')
    assert.equal(fmtE(40), '40')
    assert.equal(fmtE(166.73000000000002), '166.73')
  } finally { await server.close() }
})
