import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

test('plans retain track courses for their own curriculum when another intake loads', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { useCatalogueStore } = await server.ssrLoadModule('/src/core/stores/catalogue.js')
    const { api } = await server.ssrLoadModule('/src/core/services/api.js')
    setActivePinia(createPinia())
    api.majorRequirements = async id => ({ majorId: id, requirements: [{ _id: `${id}_CORE` }], tracks: [{ trackCode: 'BA', name: id, requirements: [{ _id: `${id}_BA`, label: 'Choose courses', rule: 'chooseN', modules: [id === 'OLD' ? 'IS111' : 'IS222'], n: id === 'OLD' ? 2 : 3, cuRequired: 4 }] }] })
    const store = useCatalogueStore()
    await store.loadMajor('OLD'); await store.loadMajor('NEW')
    assert.deepEqual(store.curricula.OLD.trackModules.BA, ['IS111'])
    assert.deepEqual(store.curricula.NEW.trackModules.BA, ['IS222'])
    assert.equal(store.curricula.MISSING, undefined)
    assert.equal(store.curricula.OLD.requirements[0]._id, 'OLD_CORE')
  } finally { await server.close() }
})
