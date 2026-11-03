import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

test('a read is retried once when the server cannot be reached; a save is never repeated', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  const realFetch = globalThis.fetch
  try {
    const { api, ApiError } = await server.ssrLoadModule('/src/core/services/api.js')
    let calls = 0
    const ok = () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })

    globalThis.fetch = async () => { calls++; if (calls === 1) throw new TypeError('fetch failed'); return ok() }
    assert.deepEqual(await api.rooms(), { ok: true })
    assert.equal(calls, 2, 'the read was repeated after the first failure')

    calls = 0
    globalThis.fetch = async () => { calls++; throw new TypeError('fetch failed') }
    await assert.rejects(api.rooms(), (error) => error instanceof ApiError && error.status === 0 && /Check your connection/.test(error.message))
    assert.equal(calls, 2, 'a read is tried twice, then reported')

    calls = 0
    await assert.rejects(api.saveCart({ planId: 'p', items: [] }), (error) => error instanceof ApiError && error.status === 0)
    assert.equal(calls, 1, 'a save is sent once, never repeated')

    calls = 0
    globalThis.fetch = async () => { calls++; return { ok: false, status: 400, json: async () => ({ error: 'Nope' }) } }
    await assert.rejects(api.rooms(), (error) => error.status === 400 && error.message === 'Nope')
    assert.equal(calls, 1, 'a server error is not retried')
  } finally { globalThis.fetch = realFetch; await server.close() }
})
