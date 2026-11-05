import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { computed, effectScope, nextTick, ref, watch } from 'vue'

test('opening the notification bell refreshes new items without remounting and retries after a failed refresh', async () => {
  const source = await readFile(new URL('../src/components/layout/AppNavBar.vue', import.meta.url), 'utf8')
  const setup = source.split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
  const settle = async () => { await nextTick(); await new Promise(setImmediate) }
  const mounts = [], errors = []
  let requests = 0, offline = false
  const records = [{ _id: 'old', read: false, message: 'Earlier event' }]
  const scope = effectScope()
  const context = vm.createContext({
    computed, ref, watch,
    onMounted: callback => mounts.push(callback), onBeforeUnmount() {},
    useRoute: () => ({ meta: {}, path: '/dashboard', fullPath: '/dashboard' }),
    useRouter: () => ({ push() {} }),
    useUserStore: () => ({ profile: {} }), useThemeStore: () => ({}),
    document: { addEventListener() {} },
    console: { error: (...args) => errors.push(args) },
    api: { notifications: async () => {
      requests++
      if (offline) throw new Error('Offline')
      return structuredClone(records)
    } },
  })
  try {
    scope.run(() => vm.runInContext(`${setup}\nglobalThis.state = { notifOpen, notifications };`, context))
    mounts.forEach(callback => callback())
    await settle()
    assert.equal(requests, 1)
    assert.deepEqual(Array.from(context.state.notifications.value, n => n._id), ['old'])

    records.unshift({ _id: 'new', read: false, message: 'A friend joined your room' })
    context.state.notifOpen.value = true
    await settle()
    assert.equal(requests, 2, 'opening the existing navbar must fetch fresh notifications')
    assert.deepEqual(Array.from(context.state.notifications.value, n => n._id), ['new', 'old'])

    context.state.notifOpen.value = false
    await settle()
    assert.equal(requests, 2, 'closing the bell does not fetch')
    offline = true
    context.state.notifOpen.value = true
    await settle()
    assert.equal(errors.length, 1)
    assert.deepEqual(Array.from(context.state.notifications.value, n => n._id), ['new', 'old'], 'a failed refresh retains the previous list')

    context.state.notifOpen.value = false
    await settle()
    offline = false
    records.unshift({ _id: 'newer', read: false, message: 'Another room event' })
    context.state.notifOpen.value = true
    await settle()
    assert.equal(requests, 4, 'reopening retries the refresh')
    assert.deepEqual(Array.from(context.state.notifications.value, n => n._id), ['newer', 'new', 'old'])
    assert.equal(mounts.length, 1, 'the navbar was never remounted')
  } finally { scope.stop() }
})

test('the bell counts older unread notifications and can load their page without losing the current list on failure', async () => {
  const source = await readFile(new URL('../src/components/layout/AppNavBar.vue', import.meta.url), 'utf8')
  const setup = source.split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
  const scope = effectScope(), mounts = [], requests = []
  const recent = Array.from({ length: 20 }, (_, i) => ({ _id: `read-${i}`, read: true }))
  let offline = false
  const context = vm.createContext({
    computed, ref, watch, nextTick, onMounted: callback => mounts.push(callback), onBeforeUnmount() {},
    useRoute: () => ({ meta: {}, path: '/dashboard' }), useRouter: () => ({ push() {} }),
    useUserStore: () => ({ profile: {} }), useThemeStore: () => ({}),
    document: { addEventListener() {} }, console: { error() {} },
    api: {
      notifications: async before => {
        requests.push(before)
        if (offline) throw new Error('Offline')
        return before ? { notifications: [recent[19], { _id: 'old-unread', read: false }], next: null, unreadCount: 1 } : { notifications: recent, next: 'cursor-20', unreadCount: 1 }
      },
      markNotificationRead: async () => {},
    },
  })
  try {
    scope.run(() => vm.runInContext(`${setup}\nglobalThis.state = { notifications, unreadCount, filteredNotifications, nextNotifications: typeof nextNotifications === 'undefined' ? null : nextNotifications, notificationsError: typeof notificationsError === 'undefined' ? null : notificationsError, loadNotifications, handleNotifClick };`, context))
    mounts.forEach(callback => callback())
    await new Promise(setImmediate)
    assert.equal(context.state.unreadCount.value, 1)
    assert.equal(context.state.filteredNotifications.value.length, 0)
    assert.equal(context.state.nextNotifications.value, 'cursor-20')

    offline = true
    await context.state.loadNotifications(true)
    assert.equal(context.state.notifications.value.length, 20)
    assert.equal(context.state.nextNotifications.value, 'cursor-20')
    assert.ok(context.state.notificationsError.value)
    offline = false
    await context.state.loadNotifications(true)
    assert.equal(requests.at(-1), 'cursor-20')
    assert.equal(context.state.notifications.value.length, 21, 'overlapping page entries are deduplicated')
    assert.equal(context.state.nextNotifications.value, null)
    assert.equal(context.state.notificationsError.value, '')
    assert.equal(context.state.filteredNotifications.value[0]._id, 'old-unread')
    await context.state.handleNotifClick(context.state.filteredNotifications.value[0])
    assert.equal(context.state.unreadCount.value, 0, 'successfully reading a notification updates the count')
  } finally { scope.stop() }
})
