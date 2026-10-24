import test from 'node:test'
import assert from 'node:assert/strict'

test('module input preserves requisite groups and rejects privilege fields and malformed rules', async () => {
  const { validateModuleInput } = await import('./modules.service.js').catch(() => ({}))
  assert.equal(typeof validateModuleInput, 'function', 'module validation is required')
  const input = { title: 'Web Development', cu: 1, prerequisites: [['IS111', 'CS101'], ['IS112']], termsOffered: ['T1'] }
  assert.deepEqual(validateModuleInput(input).prerequisites, input.prerequisites)
  for (const bad of [{ ...input, role: 'admin' }, { ...input, cu: -1 }, { ...input, prerequisites: [[]] }, { ...input, prerequisiteRules: [{ countFrom: 'ANYTHING', n: 2 }] }, { ...input, title: '' }]) assert.throws(() => validateModuleInput(bad), { status: 400 })
})

test('module saves validate references, preserve code and require revision inside audited session', async () => {
  const { createModuleEditor } = await import('./modules.service.js').catch(() => ({}))
  assert.equal(typeof createModuleEditor, 'function', 'audited module editor is required')
  const session = {}, audit = []
  let row = { _id: 'IS216', title: 'Old', cu: 1, revision: 0 }
  const editor = createModuleEditor({
    change: async (meta, fn) => { const result = await fn(session); audit.push({ meta, ...result }); return result },
    read: async (code, active) => { assert.equal(active, session); return code === 'IS216' ? row : null },
    knownCodes: async (codes, active) => { assert.equal(active, session); return codes.filter(code => code === 'IS111') },
    schoolExists: async () => true,
    insert: async (data) => data,
    replace: async (code, revision, data, active) => { assert.equal(active, session); if (revision !== row.revision) return null; row = { _id: code, ...data, revision: revision + 1 }; return row },
  })
  const actor = { _id: 'staff', role: 'admin' }
  await assert.rejects(editor.save(actor, 'IS216', { title: 'New', cu: 1 }), { status: 400 })
  await assert.rejects(editor.save(actor, 'IS216', { title: 'New', cu: 1, revision: 0, prerequisites: [['MISSING']] }), /Unknown module/)
  await assert.rejects(editor.save(actor, 'IS216', { title: 'New', cu: 1, revision: 0, prerequisites: [['IS216']] }), /itself/)
  const saved = await editor.save(actor, 'IS216', { title: 'New', cu: 1, revision: 0, prerequisites: [['IS111']] })
  assert.equal(saved.revision, 1)
  assert.equal(saved._id, 'IS216')
  assert.equal(audit[0].before.title, 'Old')
  assert.equal(audit[0].after.title, 'New')
  await assert.rejects(editor.save(actor, 'IS216', { title: 'Overwrite', cu: 1, revision: 0 }), { status: 409 })
  await assert.rejects(editor.save(actor, 'IS216', { title: 'Duplicate', cu: 1 }, true), { status: 409 })
})

test('new module creation starts revision zero and blocks students before starting a transaction', async () => {
  const { createModuleEditor } = await import('./modules.service.js')
  let started = 0
  const editor = createModuleEditor({
    change: async (meta, fn) => { started++; assert.equal(meta.action, 'create'); return fn('session') },
    read: async () => null,
    knownCodes: async () => [], schoolExists: async () => true,
    insert: async (data, session) => { assert.equal(session, 'session'); return data },
  })
  await assert.rejects(editor.save({ role: 'student' }, 'IS999', { title: 'New course', cu: 1 }, true), { status: 403 })
  assert.equal(started, 0)
  const saved = await editor.save({ role: 'admin', _id: 'staff' }, 'IS999', { title: 'New course', cu: 1 }, true)
  assert.equal(saved.revision, 0)
  assert.equal(saved._id, 'IS999')
})
