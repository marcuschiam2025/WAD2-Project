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
