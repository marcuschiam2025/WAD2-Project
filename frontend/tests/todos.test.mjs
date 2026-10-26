import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('todos are isolated by signed-in account, persist edits, and ignore unowned legacy tasks', async () => {
  const legacy = JSON.stringify([{ id: 1, text: 'Unknown owner', done: false }])
  const storage = new Map([['bidmaxxer:todos', legacy]])
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useTodosStore } = await server.ssrLoadModule('/src/core/stores/todos.js')
    const { useUserStore } = await server.ssrLoadModule('/src/core/stores/user.js')
    setActivePinia(createPinia())
    const user = useUserStore(), todos = useTodosStore()
    assert.deepEqual(todos.items, [], 'signed-out accounts have no sample or legacy tasks')
    todos.add('Signed out'); assert.deepEqual(todos.items, [])
    user.uid = 'alice'; user.isSignedIn = true
    assert.deepEqual(todos.items, [])
    todos.add(' Alice task ')
    assert.equal(todos.items[0].text, 'Alice task')
    todos.toggle(todos.items[0].id)
    assert.equal(JSON.parse(storage.get('bidmaxxer:todos:alice'))[0].done, true)
    user.uid = 'bob' // switch immediately, without waiting for the next render
    assert.deepEqual(todos.items, [])
    todos.add('Bob task')
    assert.equal(JSON.parse(storage.get('bidmaxxer:todos:alice'))[0].text, 'Alice task')
    assert.equal(JSON.parse(storage.get('bidmaxxer:todos:bob'))[0].text, 'Bob task')
    user.isSignedIn = false
    assert.deepEqual(todos.items, [])
    todos.add('No account'); assert.deepEqual(todos.items, [])
    user.uid = 'alice'; user.isSignedIn = true
    assert.equal(todos.items[0].done, true)
    todos.clearDone(); assert.deepEqual(todos.items, [])
    todos.add('One'); todos.add('Two')
    assert.equal(new Set(todos.items.map(i => i.id)).size, 2)
    todos.remove(todos.items[0].id)
    assert.equal(todos.items[0].text, 'Two')
    assert.equal(storage.get('bidmaxxer:todos'), legacy, 'do not assign or delete unowned legacy tasks')

    setActivePinia(createPinia())
    const reloadedUser = useUserStore(); reloadedUser.uid = 'bob'; reloadedUser.isSignedIn = true
    const reloaded = useTodosStore()
    assert.equal(reloaded.items[0].text, 'Bob task', 'browser reload restores only this account')
    storage.set('bidmaxxer:todos:corrupt', JSON.stringify([{ id: 1, text: null, done: 'yes' }]))
    reloadedUser.uid = 'corrupt'
    assert.deepEqual(reloaded.items, [], 'malformed stored data cannot break rendering')
    storage.set('bidmaxxer:todos:invalid-json', '{')
    reloadedUser.uid = 'invalid-json'; assert.deepEqual(reloaded.items, [])
    globalThis.localStorage = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
    reloadedUser.uid = 'blocked'
    reloaded.add('Session only')
    assert.equal(reloaded.items[0].text, 'Session only', 'blocked storage still permits session edits')
  } finally { await server.close() }
})
