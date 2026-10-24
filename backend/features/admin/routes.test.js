import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import router from './admin.routes.js'
import AuditEntry from './models/AuditEntry.js'
import { errorHandler } from '../../middleware/errorHandler.js'

test('admin endpoints enforce backend roles and page history without exposing snapshots', async () => {
  const app = express()
  app.use((req, _res, next) => { req.user = req.headers['x-test-role'] ? { role: req.headers['x-test-role'], name: 'Staff' } : undefined; next() })
  app.use('/admin', router)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}/admin`
  const original = AuditEntry.find
  try {
    for (const role of [undefined, 'student']) {
      const headers = role ? { 'x-test-role': role } : {}
      assert.equal((await fetch(url, { headers })).status, 403)
      assert.equal((await fetch(`${url}/audit`, { headers })).status, 403)
      for (const [method, path] of [['GET', '/modules'], ['GET', '/modules/IS216'], ['POST', '/modules'], ['PUT', '/modules/IS216'], ['POST', '/modules/IS216/archive'], ['POST', '/modules/IS216/restore'], ['DELETE', '/modules/IS216'], ['GET', '/curricula'], ['GET', '/curricula/BSC-IS_AY2025'], ['PUT', '/curricula/BSC-IS_AY2025/tracks/TRACK'], ['PUT', '/curricula/BSC-IS_AY2025/requirements/RULE'], ['GET', '/sections'], ['POST', '/sections'], ['PUT', '/sections/2026-27_T2/IS216/G1'], ['POST', '/sections/2026-27_T2/IS216/G1/archive'], ['POST', '/sections/2026-27_T2/IS216/G1/restore']]) assert.equal((await fetch(`${url}${path}`, { method, headers })).status, 403)
    }
    const headers = { 'x-test-role': 'admin' }
    assert.equal((await fetch(url, { headers })).status, 200)
    assert.equal((await fetch(`${url}/audit?before=invalid`, { headers })).status, 400)
    AuditEntry.find = filter => {
      assert.deepEqual(filter, {})
      return { sort(value) { assert.deepEqual(value, { _id: -1 }); return this }, limit(n) { assert.equal(n, 26); return this }, select(value) { assert.equal(value, '-before -after'); return this }, async lean() { return Array.from({ length: 26 }, (_, i) => ({ _id: String(100 - i) })) } }
    }
    const page = await (await fetch(`${url}/audit`, { headers })).json()
    assert.equal(page.entries.length, 25)
    assert.equal(page.next, '76')
  } finally { AuditEntry.find = original; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})
