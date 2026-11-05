import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { renderToString } from 'vue/server-renderer'

test('owners can confirm leaving unlocked or locked rooms, with automatic transfer explained and failures kept recoverable', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  globalThis.window = { location: { origin: 'http://localhost:5173' } }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: Detail } = await server.ssrLoadModule('/src/views/RoomDetailView.vue')
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { useRoomsStore } = await server.ssrLoadModule('/src/core/stores/rooms.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    for (const key of Object.keys(api)) api[key] = async () => []
    for (const locked of [false, true]) {
      const pinia = createPinia(); setActivePinia(pinia)
      const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true; user.profile = { _id: 'a' }
      const rooms = useRoomsStore()
      rooms.rooms = [{ id: 'r', name: 'Friends', module: 'IS216', inviteCode: 'ABC123', members: ['me', 'b'], ownerId: 'me', admins: [], term: '2026-27_T2', locked }]
      rooms.loadVotes = async () => {}
      let state
      const Wrapped = { ...Detail, setup(props, context) { state = Detail.setup(props, context); state.confirmLeave.value = true; return state } }
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/rooms/:id', component: Wrapped }, { path: '/:pathMatch(.*)*', component: { render: () => null } }] })
      await router.push('/rooms/r')
      const app = createSSRApp(Wrapped).use(pinia).use(router); app.directive('enter', {})
      const context = {}
      await renderToString(app, context)
      const dialog = context.teleports.body
      const leaveButton = dialog.match(/<button\b[^>]*>[\s\S]*?<\/button>/g).find(button => button.includes('Leave room'))
      assert.doesNotMatch(leaveButton, / disabled(?:[=>\s])/, 'the owner must be able to leave while another member remains')
      assert.match(dialog, /automatically becomes party admin/)
      assert.doesNotMatch(dialog, /Make another member/)

      let requests = 0
      api.leaveRoom = async id => { requests++; assert.equal(id, 'r'); throw new Error('Connection lost') }
      await state.leave()
      assert.equal(state.confirmLeave.value, true)
      assert.equal(state.leaving.value, false)
      assert.equal(state.error.value, 'Connection lost')
      assert.ok(rooms.getRoom('r'), 'a failed leave must keep the room')
      assert.equal(router.currentRoute.value.path, '/rooms/r')

      api.leaveRoom = async id => { requests++; assert.equal(id, 'r') }
      const navigated = new Promise(resolve => router.afterEach(to => { if (to.path === '/rooms') resolve() }))
      await state.leave(); await navigated
      assert.equal(requests, 2)
      assert.equal(rooms.getRoom('r'), undefined)
      assert.equal(state.confirmLeave.value, false)
    }
  } finally { delete globalThis.window; await server.close() }
})
