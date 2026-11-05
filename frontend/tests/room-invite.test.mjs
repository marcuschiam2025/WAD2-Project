import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { renderToString } from 'vue/server-renderer'

const store = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) } }

test('an invite link carries the code, and a kept code is handed over once', async () => {
  globalThis.sessionStorage = store()
  const { inviteLink, rememberJoin, takeJoin } = await import('../src/core/utils/roomInvite.js')
  assert.equal(inviteLink('K7Q2MX', 'https://bidmaxxer.example'), 'https://bidmaxxer.example/rooms?join=K7Q2MX')
  assert.equal(takeJoin(), null)
  rememberJoin('K7Q2MX')
  assert.equal(takeJoin(), 'K7Q2MX')
  assert.equal(takeJoin(), null, 'it does not reopen the dialog on every later page')
})

test('alone in an unlocked room the page is just the invite; with friends, or locked, it is the full room', async () => {
  globalThis.localStorage = store(); globalThis.sessionStorage = store()
  globalThis.window = { location: { origin: 'https://bidmaxxer.example' } }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: RoomDetail } = await server.ssrLoadModule('/src/views/RoomDetailView.vue')
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    const { useRoomsStore } = await server.ssrLoadModule('/src/core/stores/rooms.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    for (const name of Object.keys(api)) api[name] = async () => []
    const render = async (members, extra = {}) => {
      const pinia = createPinia(); setActivePinia(pinia)
      const user = useUserStore(); user.uid = 'a'; user.isSignedIn = true; user.profile = { _id: 'a', email: 'a@smu.edu.sg' }
      useRoomsStore().rooms = [{ id: 'r', name: 'Friends', module: 'IS216', inviteCode: 'K7Q2MX', maxMembers: 8, members, ownerId: 'me', admins: [], term: 't', ...extra }]
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/rooms/:id', component: RoomDetail }, { path: '/rooms', component: { render: () => null } }, { path: '/bidding', component: { render: () => null } }] })
      await router.push('/rooms/r')
      const app = createSSRApp(RoomDetail).use(pinia).use(router)
      app.directive('enter', { getSSRProps: () => ({}) })
      return renderToString(app)
    }
    const solo = await render(['me'])
    assert.match(solo, /Invite your friends/)
    assert.match(solo, /K7Q2MX/)
    assert.match(solo, /rooms\?join=K7Q2MX/)
    assert.doesNotMatch(solo, /Modules for bid/, 'nothing to vote on yet')
    assert.doesNotMatch(solo, /Members ·/)

    const together = await render(['me', 'b'])
    assert.doesNotMatch(together, /Invite your friends/)
    assert.match(together, /Modules for bid/)
    assert.match(together, /Copy invite link/, 'the link is still there once friends have joined')

    const lockedAlone = await render(['me'], { locked: true, lockedSection: 'g1' })
    assert.doesNotMatch(lockedAlone, /Invite your friends/, 'the party admin must still be able to reach Unlock')
    assert.match(lockedAlone, /Modules for bid/)
    assert.match(lockedAlone, /nobody can join/)
  } finally { delete globalThis.window; await server.close() }
})
