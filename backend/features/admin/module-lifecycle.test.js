import test from 'node:test'
import assert from 'node:assert/strict'

test('module lifecycle audits revision-checked archive and restore and blocks unsafe deletion', async () => {
  const { createModuleLifecycle } = await import('./module-lifecycle.js').catch(() => ({}))
  assert.equal(typeof createModuleLifecycle, 'function', 'module lifecycle service is required')
  let row = { _id: 'TEST999', title: 'Test', revision: 0 }, dependencies = [], createdByStaff = true
  const events = [], session = {}
  const service = createModuleLifecycle({
    change: async (meta, mutate) => { const result = await mutate(session); events.push({ ...meta, ...result }); return result },
    read: async () => row,
    dependencies: async (_code, active) => { assert.equal(active, session); return dependencies },
    createdByStaff: async () => createdByStaff,
    write: async (_code, revision, update, active) => { assert.equal(active, session); if (row.revision !== revision) return null; row = { ...row, ...update, revision: revision + 1 }; return row },
    remove: async (_code, revision) => { if (row.revision !== revision) return false; row = null; return true },
  })
  const actor = { role: 'admin', _id: 'staff' }
  await assert.rejects(service.apply({ role: 'student' }, 'TEST999', { revision: 0 }, 'archive'), { status: 403 })
  await assert.rejects(service.apply(actor, 'TEST999', {}, 'archive'), { status: 400 })
  await assert.rejects(service.apply(actor, 'TEST999', { revision: 0 }, 'delete'), /Archive/)
  await service.apply(actor, 'TEST999', { revision: 0 }, 'archive')
  assert.equal(row.archived, true)
  assert.equal(events[0].action, 'archive')
  await assert.rejects(service.apply(actor, 'TEST999', { revision: 0 }, 'restore'), { status: 409 })
  await service.apply(actor, 'TEST999', { revision: 1 }, 'restore')
  assert.equal(row.archived, false)
  await service.apply(actor, 'TEST999', { revision: 2 }, 'archive')
  dependencies = ['Degree plans']
  await assert.rejects(service.apply(actor, 'TEST999', { revision: 3 }, 'delete'), /Degree plans/)
  dependencies = []; createdByStaff = false
  await assert.rejects(service.apply(actor, 'TEST999', { revision: 3 }, 'delete'), /seeded/)
  createdByStaff = true
  await service.apply(actor, 'TEST999', { revision: 3 }, 'delete')
  assert.equal(row, null)
  assert.equal(events.at(-1).after, null)
  assert.equal(events.at(-1).before.archived, true)
})
