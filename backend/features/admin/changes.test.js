import test from 'node:test'
import assert from 'node:assert/strict'

test('audit foundation requires an admin and uses the same transaction for mutation and audit', async () => {
  const { createAuditedChange } = await import('./changes.js').catch(() => ({}))
  assert.equal(typeof createAuditedChange, 'function', 'audited mutation service is required')
  const session = { transaction: true }
  const events = []
  const change = createAuditedChange({ transaction: async fn => fn(session), writeAudit: async (entry, active) => { assert.equal(active, session); events.push(entry) } })
  const data = { actor: { _id: 'admin-id', role: 'admin' }, action: 'update', entity: 'module', entityId: 'IS216' }
  const result = await change(data, async active => { assert.equal(active, session); return { before: { revision: 0 }, after: { revision: 1 } } })
  assert.equal(result.after.revision, 1)
  assert.equal(events[0].actorId, 'admin-id')
  assert.deepEqual(events[0].before, { revision: 0 })
  await assert.rejects(change({ ...data, actor: { role: 'student' } }, () => assert.fail('denied before mutation')), { status: 403 })
  const failing = createAuditedChange({ transaction: async fn => fn(session), writeAudit: async () => { throw Error('audit unavailable') } })
  await assert.rejects(failing(data, async () => ({ before: {}, after: {} })), /audit unavailable/)
})
test('revision filter protects legacy records and rejects missing or invalid revisions', async () => {
  const { revisionFilter } = await import('./changes.js').catch(() => ({}))
  assert.equal(typeof revisionFilter, 'function')
  assert.deepEqual(revisionFilter('IS216', 2), { _id: 'IS216', revision: 2 })
  assert.deepEqual(revisionFilter('IS216', 0), { _id: 'IS216', $or: [{ revision: 0 }, { revision: { $exists: false } }] })
  for (const bad of [undefined, -1, '2', 1.5]) assert.throws(() => revisionFilter('IS216', bad), { status: 400 })
})
