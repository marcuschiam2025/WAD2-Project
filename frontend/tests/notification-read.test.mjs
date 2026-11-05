import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { renderToString } from 'vue/server-renderer'

test('failed mark-read keeps notifications unread and retryable; success updates the count once and navigates', async t => {
  const errors = []
  t.mock.method(console, 'error', (...args) => errors.push(args))
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: Nav } = await server.ssrLoadModule('/src/components/layout/AppNavBar.vue')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    const pinia = createPinia(); setActivePinia(pinia)
    const records = [{ _id: 'one', read: false, link: '/rooms/r', message: 'Room updated' }, { _id: 'two', read: false, message: 'Another event' }]
    api.notifications = async () => ({ notifications: structuredClone(records), unreadCount: records.filter(n => !n.read).length, next: null })
    let reject, requests = 0
    const pending = new Promise((_, no) => { reject = no })
    api.markNotificationRead = () => { requests++; return pending }
    let view
    const Wrapped = { ...Nav, setup(props, context) { view = Nav.setup(props, context); return view } }
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })
    await router.push('/dashboard')
    await renderToString(createSSRApp(Wrapped).use(pinia).use(router))
    view.notifOpen.value = true
    await view.loadNotifications()
    const item = view.notifications.value[0]
    const reading = view.handleNotifClick(item)
    assert.equal(item.read, false, 'a pending request must not hide the unread item')
    assert.equal(view.unreadCount.value, 2)
    await view.handleNotifClick(item)
    assert.equal(requests, 1, 'repeated clicks share the pending read operation')
    reject(new Error('Offline'))
    await reading
    assert.equal(item.read, false)
    assert.equal(view.filteredNotifications.value.length, 2)
    assert.equal(view.unreadCount.value, 2)
    assert.equal(view.notifOpen.value, true)
    assert.equal(errors.length, 1)
    assert.match(view.notificationsError.value, /mark.*read|try again/i)
    assert.equal(router.currentRoute.value.path, '/dashboard')

    api.markNotificationRead = async id => { requests++; assert.equal(id, 'one'); records[0].read = true }
    const navigated = new Promise(resolve => router.afterEach(to => { if (to.path === '/rooms/r') resolve() }))
    await view.handleNotifClick(item); await navigated
    assert.equal(item.read, true)
    assert.equal(view.unreadCount.value, 1)
    assert.equal(view.notificationsError.value, '')
    assert.equal(view.notifOpen.value, false)
    assert.equal(view.filteredNotifications.value.length, 1)
    await view.handleNotifClick(item)
    assert.equal(requests, 2, 'an already-read item must not decrement the count again')
    assert.equal(view.unreadCount.value, 1)

    const stalePage = { notifications: structuredClone(records), unreadCount: 1, next: null }
    let finishRefresh, reads = 0
    api.notifications = () => {
      if (++reads === 1) return new Promise(resolve => { finishRefresh = resolve })
      return Promise.resolve({ notifications: structuredClone(records), unreadCount: 0, next: null })
    }
    api.markNotificationRead = async id => { assert.equal(id, 'two'); records[1].read = true }
    const refresh = view.loadNotifications()
    await view.handleNotifClick(view.notifications.value.find(n => n._id === 'two'))
    finishRefresh(stalePage)
    await refresh
    assert.equal(view.unreadCount.value, 0, 'a delayed refresh must not resurrect a successfully read notification')
    assert.ok(view.notifications.value.every(n => n.read))
  } finally { await server.close() }
})
