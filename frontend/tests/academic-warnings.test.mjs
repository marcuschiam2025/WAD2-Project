import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { checkPlan as backendCheck } from '../../backend/features/planning/utils/requirementChecker.js'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

test('planner warnings match backend rules for unsaved edits, exclusions, counts, alternatives and exemptions', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
    const { liveModules } = await server.ssrLoadModule('/src/core/data/catalogue.js')
    setActivePinia(createPinia())
    const user = useUserStore(); user.profile.exempted = ['EXEMPT_TARGET']
    const catalogue = Object.fromEntries(['OLD', 'CORE1', 'CORE2', 'TRACK1', 'TRACK2', 'TRACK3', 'TRACKX', 'TARGET', 'EXCLUDED', 'COUNT', 'RETIRED', 'OR', 'EXEMPT_TARGET'].map(code => [code, { _id: code, title: code, cu: 1 }]))
    catalogue.OLD.prerequisites = [['NOPE']]
    catalogue.TARGET.prerequisites = [['CORE1']]
    catalogue.TARGET.corequisites = [['CORE2']]
    for (const code of ['TRACK1', 'TRACK2', 'TRACK3', 'TRACKX']) catalogue[code].categories = ['IS_TRACK']
    catalogue.EXCLUDED.mutuallyExclusive = ['OLD']
    catalogue.COUNT.prerequisiteRules = [{ countFrom: 'TRACK', n: 3 }]
    catalogue.RETIRED.offeredRecently = false; catalogue.RETIRED.lastOffered = 'AY23/24 T1'
    catalogue.OR.prerequisites = [['MISSING', 'CORE1'], ['ALT1', 'ALT2']]
    catalogue.EXEMPT_TARGET.prerequisites = [['NOPE']]
    Object.assign(liveModules, catalogue)
    const plan = { id: 'p', tracks: [], currentSem: 'Y1S2', semesters: [
      { id: 'Y1S1', modules: ['OLD'] }, { id: 'Y1S2', modules: ['CORE1', 'TRACK1'] },
      { id: 'Y2S1', modules: ['TRACK2', 'ABROAD → CORE2'] },
      { id: 'Y2S2', modules: ['TARGET', 'EXCLUDED', 'COUNT', 'RETIRED', 'OR', 'TRACK3', 'EXEMPT_TARGET'] },
    ] }
    const planner = usePlannerStore(); planner.plans = [plan]; planner.activePlanId = 'p'
    assert.deepEqual(planner.checkModule(plan, 'TARGET', 'Y2S2').coreqs, [], 'a corequisite in an earlier future semester is valid')
    assert.equal(planner.hasWarning(plan, 'OLD', 'Y1S1'), false, 'completed semesters do not show academic warnings')
    assert.equal(planner.hasWarning(plan, 'EXEMPT_TARGET', 'Y2S2'), false, 'profile exemptions take precedence over stale placements')
    assert.equal(planner.hasWarning(plan, 'EXCLUDED', 'Y2S2'), true)
    assert.equal(planner.hasWarning(plan, 'COUNT', 'Y2S2'), true, 'a track course in the same semester cannot meet a before-course rule')
    const expected = backendCheck(plan, { major: { _id: 'TEST' }, requirements: [], catalogue, exempted: user.profile.exempted }).warnings
    const actual = []
    for (const sem of plan.semesters) for (const code of sem.modules) {
      if (!planner.hasWarning(plan, code, sem.id)) continue
      const check = planner.checkModule(plan, code, sem.id)
      actual.push({ module: code.split('→').pop().trim(), semester: sem.id, prereqs: check.prereqGroups, coreqs: check.coreqGroups, exclusions: check.exclusions, rules: check.rules, ...(check.notOffered ? { notOffered: check.notOffered } : {}) })
    }
    assert.deepEqual(actual, expected, 'the live frontend and server agree on every warning')
    assert.match(planner.warningMessages(plan, 'EXCLUDED', 'Y2S2').join(' '), /exclu.*OLD/i)
    assert.match(planner.warningMessages(plan, 'COUNT', 'Y2S2').join(' '), /3 track courses before/i)
    assert.match(planner.warningMessages(plan, 'OR', 'Y2S2').join(' '), /ALT1 or ALT2/)
    assert.match(planner.warningMessages(plan, 'RETIRED', 'Y2S2').join(' '), /not offered.*AY23\/24 T1/i)
    user.profile.exempted.push('TRACKX', 'ALT2')
    assert.equal(planner.hasWarning(plan, 'COUNT', 'Y2S2'), false, 'an exempted track course counts before the target')
    assert.equal(planner.hasWarning(plan, 'OR', 'Y2S2'), false, 'any alternative in each prerequisite group suffices')
    plan.semesters[2].modules = ['TRACK2']
    assert.deepEqual(planner.checkModule(plan, 'TARGET', 'Y2S2').coreqs, ['CORE2'], 'unsaved edits immediately recompute warnings')
    plan.semesters[3].modules.push('CORE2')
    assert.deepEqual(planner.checkModule(plan, 'TARGET', 'Y2S2').coreqs, [], 'same-semester corequisites remain valid')
  } finally { await server.close() }
})

test('the warning dialog renders exclusion, count and offering reasons instead of an empty prerequisite warning', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: Warning } = await server.ssrLoadModule('/src/components/modals/PrereqWarningModal.vue')
    const context = {}
    await renderToString(createSSRApp(Warning, { code: 'IS483', semLabel: 'Y3S1', exclusions: ['CS102'], rules: ['2 track courses before this one'], notOffered: { lastOffered: 'AY23/24 T1' } }), context)
    const html = context.teleports.body
    assert.match(html, /Exclusion/)
    assert.match(html, /CS102/)
    assert.match(html, /2 track courses before this one/)
    assert.match(html, /Not offered since AY23\/24 T1/)
    assert.doesNotMatch(html, /undefined/)
  } finally { await server.close() }
})
