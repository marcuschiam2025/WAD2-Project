import test from 'node:test'
import assert from 'node:assert/strict'
import { createRoundEditor, validateRound } from './rounds.service.js'

test('round inputs require an academic term, round name and explicit timezone', () => {
  const input = { term: '2026-27_T2', round: '1A', closesAt: '2026-11-01T12:00:00+08:00', revision: 0 }
  assert.equal(validateRound(input).closesAt.toISOString(), '2026-11-01T04:00:00.000Z')
  for (const patch of [{ closesAt: '2026-11-01T12:00' }, { closesAt: 'bad' }, { closesAt: '2026-02-31T12:00:00+08:00' }, { round: '' }, { term: 'bad' }, { role: 'admin' }, { revision: -1 }]) assert.throws(() => validateRound({ ...input, ...patch }), { status: 400 })
})
test('round saves audit the same transaction and reject students, stale revisions and unknown terms', async () => {
  let row = null, audit, writes = 0
  const editor = createRoundEditor({
    change: async (meta, mutate) => { const result = await mutate('tx'); audit = { ...meta, ...result }; return result },
    read: async session => { assert.equal(session, 'tx'); return row },
    terms: async session => { assert.equal(session, 'tx'); return ['2026-27_T2'] },
    write: async (before, data, session) => { assert.equal(session, 'tx'); writes++; row = { _id: 'active', ...data, revision: (before?.revision ?? 0) + 1 }; return row },
  })
  const actor = { _id: 'staff', role: 'admin' }, input = { term: '2026-27_T2', round: '1A', closesAt: '2026-11-01T12:00:00+08:00', revision: 0 }
  await assert.rejects(editor.save({ role: 'student' }, input), { status: 403 })
  await assert.rejects(editor.save(actor, { ...input, term: '2030-31_T1' }), /catalogue/)
  const saved = await editor.save(actor, input)
  assert.equal(saved.revision, 1); assert.equal(audit.entity, 'bidding-round'); assert.equal(audit.before, null)
  await assert.rejects(editor.save(actor, input), { status: 409 }); assert.equal(writes, 1)
})
