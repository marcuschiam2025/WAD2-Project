import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { profileUpdate } from '../../backend/features/auth/utils/profile.js'

async function fixture(t, editing) {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  t.after(() => server.close())
  const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
  const { usePlannerStore } = await server.ssrLoadModule('/src/core/stores/planner.js')
  const { useCatalogueStore } = await server.ssrLoadModule('/src/core/stores/catalogue.js')
  const { api } = await server.ssrLoadModule('/src/core/services/api.js')
  const { default: Form } = await server.ssrLoadModule('/src/components/DegreeForm.vue')
  const pinia = createPinia(); setActivePinia(pinia)
  const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true; user.onboarded = editing
  let profile = { currentSem: 'Y2S1', takenBySem: { Y1S1: ['IS111'] }, loaSemesters: [], tracks: [], balance: 210, onboarded: editing, intakeYear: 2025 }
  user.profile = structuredClone(profile)
  const catalogue = useCatalogueStore(); catalogue.load = async () => {}; catalogue.loadMajor = async () => {}; catalogue.online = true
  const semesters = Array.from({ length: 8 }, (_, i) => ({ id: `Y${Math.floor(i / 2) + 1}S${i % 2 + 1}`, modules: i === 0 ? ['IS111'] : i === 1 ? ['IS999'] : i === 3 ? ['IS213'] : [], loa: false, exchange: false }))
  api.plans = async () => editing ? [{ _id: 'p', name: 'Plan 1', majorId: null, tracks: [], currentSem: 'Y2S1', semesters: structuredClone(semesters) }] : []
  const profileWrites = [], planWrites = []
  api.updateMe = async body => { profileWrites.push(body); profile = { ...profile, ...profileUpdate(body, profile) }; return structuredClone(profile) }
  api.updatePlan = async (id, body) => { planWrites.push(body); return { _id: id, ...body } }
  api.createPlan = async body => { planWrites.push(body); return { _id: 'p', name: 'Plan 1', ...body } }
  const planner = usePlannerStore()
  if (editing) await planner.load()
  const mount = async mode => {
    let state
    const Wrapped = { ...Form, setup(props, context) { state = Form.setup(props, context); return state } }
    const app = createSSRApp(Wrapped, { mode }).use(pinia); app.directive('stagger', {})
    const html = await renderToString(app)
    return { state, html }
  }
  return { user, planner, mount, profileWrites, planWrites }
}

for (const editing of [false, true]) test(`${editing ? 'profile editing' : 'onboarding'} accepts a historical LOA and preserves it in saved plans and a reopened form`, async t => {
  const { user, planner, mount, profileWrites, planWrites } = await fixture(t, editing)
  const { state } = await mount(editing ? 'edit' : 'onboarding')
  if (!editing) {
    state.currentSem.value = 'Y2S1'; state.eCredits.value = '210'; state.toggleUndecided()
    state.placed.value.Y1S1 = ['IS111']
    await nextTick()
  }
  assert.match(state.missing.value, /modules/)
  assert.equal(typeof state.toggleLoa, 'function')
  state.toggleLoa('Y1S2')
  assert.equal(state.missing.value, '')
  await state.submit(); await nextTick()
  if (!editing) await planner.load()
  await planner.savePlans()
  assert.deepEqual(profileWrites[0].loaSemesters, ['Y1S2'])
  assert.deepEqual(user.profile.completed, ['IS111'], 'the empty LOA invents no courses')
  assert.equal(planner.activePlan.semesters.find(s => s.id === 'Y1S2').loa, true)
  assert.equal(planner.activePlan.semesters.filter(s => !s.loa).length, 8, 'an LOA does not remove a regular study term')
  assert.ok(planWrites.at(-1).semesters.find(s => s.id === 'Y1S2').loa)
  if (editing) {
    assert.ok(planner.basket.includes('IS999'), 'planner-only courses from the newly marked LOA are preserved in the basket')
    assert.deepEqual(planner.activePlan.semesters.find(s => s.id === 'Y2S2').modules, ['IS213'], 'future choices stay in their terms')
  }
  const reopened = await mount('edit')
  assert.deepEqual([...reopened.state.loaSemesters.value], ['Y1S2'])
  assert.equal(reopened.state.missing.value, '')
  assert.match(reopened.html, /Y1S2 leave of absence/)
  await reopened.state.submit(); await nextTick()
  assert.equal(planner.activePlan.semesters.length, 9, 'saving the same LOA again must not keep extending the plan')
  reopened.state.toggleLoa('Y1S2')
  assert.match(reopened.state.missing.value, /modules/, 'unmarking restores the normal course requirement')
  reopened.state.placed.value.Y1S2 = ['IS112']
  await reopened.state.submit(); await nextTick()
  assert.deepEqual([...user.profile.loaSemesters], [])
  assert.equal(planner.activePlan.semesters.find(s => s.id === 'Y1S2').loa, false)
})

test('LOA form controls preserve displaced courses, reject regular-course drops and keep profile/plan limits consistent', async t => {
  const { planner, mount, profileWrites } = await fixture(t, true)
  const { state } = await mount('edit')
  assert.equal(typeof state.toggleLoa, 'function')
  state.placed.value.Y1S2 = ['IS112']
  state.toggleLoa('Y1S2')
  assert.deepEqual([...state.basket.value], ['IS112'])
  state.dragging.value = 'IS112'; state.drop('Y1S2')
  assert.deepEqual([...state.basket.value], ['IS112'], 'a rejected drop must not discard the course')
  assert.deepEqual([...state.placed.value.Y1S2], [])
  state.unplace('IS112')
  state.toggleLoa('Y2S1')
  assert.deepEqual([...state.loaSemesters.value], ['Y1S2'], 'the current semester cannot be historical LOA')

  const other = JSON.parse(JSON.stringify(planner.activePlan))
  other.id = 'other'; other.name = 'Plan 2'
  other.semesters.find(s => s.id === 'Y3S1').loa = true
  other.semesters.find(s => s.id === 'Y3S2').loa = true
  planner.plans.push(other)
  await state.submit()
  assert.equal(profileWrites.length, 0, 'conflicting future LOA terms must be resolved before changing the saved profile')
  assert.match(state.saveError.value, /Plan 2.*LOA/)
  planner.plans[1].semesters.find(s => s.id === 'Y3S2').loa = false
  await state.submit(); await nextTick()
  assert.equal(profileWrites.filter(body => body.loaSemesters).length, 1)
  assert.equal(planner.plans[1].semesters.filter(s => s.loa).length, 2)
  assert.ok(planner.plans.every(p => p.semesters.find(s => s.id === 'Y1S2').loa), 'all plans receive the historical LOA')
})
