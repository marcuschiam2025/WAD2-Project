import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

const setup = async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  const load = (path) => server.ssrLoadModule(path)
  const { useUserStore } = await load('/src/core/stores/user.js')
  const { usePlannerStore } = await load('/src/core/stores/planner.js')
  const { useCatalogueStore } = await load('/src/core/stores/catalogue.js')
  const { useBiddingStore } = await load('/src/core/stores/bidding.js')
  const { api } = await load('/src/core/services/api.js')
  setActivePinia(createPinia())
  return { server, api, user: useUserStore(), planner: usePlannerStore(), catalogue: useCatalogueStore(), bidding: useBiddingStore() }
}
const sem = (id, modules = [], extra = {}) => ({ id, label: id, modules, ...extra })
const apiPlan = (semesters) => ({ _id: 'p', name: 'Plan 1', tracks: [], majorId: 'M', currentSem: 'Y2S1', semesters })
const prepare = ({ api, user, catalogue }, profile, semesters) => {
  user.uid = 'a'; user.isSignedIn = true; user.onboarded = true
  user.profile = { major: 'Information Systems', tracks: [], exempted: [], basket: [], takenBySem: { Y1S1: ['IS111'] }, loaSemesters: [], currentSem: 'Y2S1', intakeYear: 2025, ...profile }
  catalogue.load = async () => {}
  catalogue.loadMajor = () => {}
  catalogue.online = true
  api.plans = async () => [apiPlan(semesters)]
  api.updatePlan = async (_id, plan) => ({ ...apiPlan(semesters), ...plan })
  const sent = []
  api.updateMe = async (changes) => { sent.push(changes); return { ...user.profile, ...changes, onboarded: true, email: 'a@smu.edu.sg', semestersDue: 0 } }
  return sent
}

test('when a semester has ended the student moves forward and the plan decides what they took', async () => {
  const ctx = await setup()
  try {
    const sent = prepare(ctx, { semestersDue: 1 }, [sem('Y1S1', ['IS111']), sem('Y2S1', ['CS412 → IS216', 'IS112']), sem('Y2S2', ['IS442']), sem('Y3S1', ['IS483'])])
    await ctx.planner.load()
    assert.equal(sent.length, 1)
    assert.equal(sent[0].currentSem, 'Y2S2')
    assert.deepEqual(sent[0].takenBySem.Y2S1, ['IS216', 'IS112'], 'the finished semester is recorded')
    assert.deepEqual(sent[0].takenBySem.Y2S2, ['IS442'], 'and what is in progress now')
    assert.equal(sent[0].takenBySem.Y3S1, undefined, 'later semesters are still only plans')
    assert.deepEqual(ctx.planner.semesterMoved, { from: 'Y2S1', to: 'Y2S2' })
    assert.equal(ctx.planner.activePlan.currentSem, 'Y2S2')
  } finally { await ctx.server.close() }
})

test('nothing happens when no semester has ended, and it stops at the last semester', async () => {
  const ctx = await setup()
  try {
    const sent = prepare(ctx, {}, [sem('Y2S1'), sem('Y2S2')])
    await ctx.planner.load()
    assert.equal(sent.length, 0)
    assert.equal(ctx.planner.semesterMoved, null)
  } finally { await ctx.server.close() }
  const last = await setup()
  try {
    const sent = prepare(last, { currentSem: 'Y4S2', semestersDue: 1 }, [sem('Y4S1'), sem('Y4S2', ['IS484'])])
    await last.planner.load()
    assert.equal(sent[0].currentSem, 'Y4S2', 'marked as checked without moving')
    assert.equal(last.planner.semesterMoved, null)
  } finally { await last.server.close() }
})

test('bidding follows the term, so Round 2 still shows the semester that has just started', async () => {
  const ctx = await setup()
  try {
    prepare(ctx, { currentSem: 'Y2S2' }, [sem('Y2S1'), sem('Y2S2'), sem('Y3S1')])
    await ctx.planner.load()
    ctx.planner.activePlan.currentSem = 'Y2S2'
    ctx.bidding.planId = 'p'
    assert.equal(ctx.bidding.targetSem.id, 'Y3S1', 'before the round loads: the next semester')
    ctx.bidding.round = { term: '2026-27_T2' }
    assert.equal(ctx.bidding.targetSem.id, 'Y2S2')
    ctx.bidding.round = { term: '2027-28_T1' }
    assert.equal(ctx.bidding.targetSem.id, 'Y3S1')
    ctx.bidding.round = { term: '2026-27_T1' }
    assert.equal(ctx.bidding.targetSem.id, 'Y3S1', 'a past term falls back to the next semester')
  } finally { await ctx.server.close() }
})
