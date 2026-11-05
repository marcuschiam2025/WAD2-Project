import test from 'node:test'
import assert from 'node:assert/strict'
import { getWindows } from './bidding.controller.js'
import BiddingWindow from './models/BiddingWindow.js'

const response = () => ({ json(body) { this.body = body; return this } })

test('windows come from the database, filtered by term, earliest first, with estimated times flagged', async () => {
  const find = BiddingWindow.find
  let filter, sort
  const rows = [
    { _id: 'a', term: '2026-27_T2', round: '1A', window: 1, opensAt: new Date(1), closesAt: new Date(2) },
    { _id: 'b', term: '2026-27_T2', round: '1A', window: 3, opensAt: new Date(3), closesAt: new Date(4), note: 'times inferred, check BOSS' },
    { _id: 'c', term: '2026-27_T2', round: '2', window: 1, opensAt: new Date(5), closesAt: new Date(6), note: 'moved by the registrar' },
  ]
  BiddingWindow.find = f => { filter = f; return { sort(s) { sort = s; return { lean: async () => rows } } } }
  try {
    const res = response()
    await getWindows({ query: { term: 'AY26/27 T2' } }, res)
    assert.deepEqual(filter, { term: '2026-27_T2' }, 'either term format works')
    assert.deepEqual(sort, { opensAt: 1 })
    assert.deepEqual(res.body.map(w => w.inferred), [false, true, false])
    assert.ok(res.body.every(w => !('note' in w)))
    await getWindows({ query: {} }, response())
    assert.deepEqual(filter, {})
    await assert.rejects(getWindows({ query: { term: 'nonsense' } }, response()), { status: 400 })
  } finally { BiddingWindow.find = find }
})
