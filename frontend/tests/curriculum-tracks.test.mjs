import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'

// The track pickers only offer a curriculum's own tracks: DCS exists on the 2023 curriculum alone.
test('tracksFor follows the curriculum and falls back to the sample list until it has loaded', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { useCatalogueStore } = await server.ssrLoadModule('/src/core/stores/catalogue.js')
    setActivePinia(createPinia())
    const catalogue = useCatalogueStore()
    const track = (trackCode, name, description) => ({ trackCode, name, description, requirements: [] })

    const sampleCodes = ['BA', 'SMCT', 'FT', 'PD']
    assert.deepEqual(catalogue.tracksFor('NOT_LOADED').map((t) => t.code), sampleCodes)
    assert.deepEqual(catalogue.tracksFor(null).map((t) => t.code), sampleCodes)

    catalogue.curricula.AY2023 = {
      tracks: [track('BA', 'Business Analytics'), track('DCS', 'Digitalisation & Cloud Solutions', 'Retired.'), track('FT', 'Financial Technology'), track('PD', 'Product Development'), track('SMCT', 'Smart-City')],
    }
    catalogue.curricula.AY2025 = {
      tracks: [track('BA', 'Business Analytics'), track('FT', 'Financial Technology'), track('PD', 'Product Development'), track('SMCT', 'Smart-City')],
    }

    assert.deepEqual(catalogue.tracksFor('AY2023').map((t) => t.code), ['BA', 'SMCT', 'FT', 'PD', 'DCS'])
    assert.deepEqual(catalogue.tracksFor('AY2025').map((t) => t.code), sampleCodes)
    const dcs = catalogue.tracksFor('AY2023').at(-1)
    assert.equal(dcs.name, 'Digitalisation & Cloud Solutions')
    assert.equal(dcs.blurb, 'Retired.')
  } finally {
    await server.close()
  }
})

test('a track only the 2023 curriculum has shows its name, not its code', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  try {
    const { trackName, tracks } = await server.ssrLoadModule('/src/core/data/catalogue.js')
    assert.equal(trackName('DCS'), 'Digitalisation & Cloud Solutions')
    assert.equal(trackName('BA'), 'Business Analytics')
    assert.equal(trackName('NOPE'), 'NOPE', 'an unknown code still shows something')
    assert.equal(tracks.some((t) => t.code === 'DCS'), false, 'it stays out of the list new students choose from')
  } finally { await server.close() }
})
