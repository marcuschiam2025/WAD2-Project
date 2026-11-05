import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import Notification from './model/notification.js'
import { listMine } from './notifications.controller.js'

test('notification pages expose older unread records and return the full unread count', async () => {
  const original = { find: Notification.find, findOne: Notification.findOne, count: Notification.countDocuments }
  const rows = Array.from({ length: 21 }, (_, i) => ({ _id: new mongoose.Types.ObjectId(String(100 - i).padStart(24, '0')), user: 'student', read: i < 20, createdAt: new Date('2026-11-05T00:00:00Z') }))
  const queries = []
  Notification.find = query => {
    queries.push(query)
    return { sort: order => {
      assert.deepEqual(order, { createdAt: -1, _id: -1 }, 'equal timestamps need a stable secondary order')
      return { limit: async size => { assert.equal(size, 21); return query.$or ? rows.slice(20) : rows } }
    } }
  }
  Notification.findOne = query => {
    assert.equal(query.user, 'student')
    assert.equal(String(query._id), String(rows[19]._id))
    return { select: () => ({ lean: async () => rows[19] }) }
  }
  Notification.countDocuments = async query => { assert.deepEqual(query, { user: 'student', read: false }); return 1 }
  try {
    let first, second
    await listMine({ user: { _id: 'student' }, query: {} }, { json: data => { first = data } })
    assert.equal(first.unreadCount, 1, 'read rows in this page must not hide unread records in older pages')
    assert.equal(first.notifications.length, 20)
    assert.equal(first.next, String(rows[19]._id))
    await listMine({ user: { _id: 'student' }, query: { before: first.next } }, { json: data => { second = data } })
    assert.equal(second.notifications[0].read, false)
    assert.equal(second.next, null)
    assert.equal(second.unreadCount, 1)
    assert.ok(queries.every(q => q.user === 'student'))
    assert.ok(queries[1].$or.some(q => q._id?.$lt?.equals(rows[19]._id)), 'ties page by ID as well as timestamp')
  } finally { Notification.find = original.find; Notification.findOne = original.findOne; Notification.countDocuments = original.count }
})

test('notification cursors are validated and cannot reference another user’s record', async () => {
  const findOne = Notification.findOne, find = Notification.find
  Notification.find = () => { throw new Error('A bad cursor must be rejected before listing notifications') }
  let reads = 0
  Notification.findOne = query => {
    reads++
    assert.equal(query.user, 'student')
    return { select: () => ({ lean: async () => null }) }
  }
  try {
    for (const before of ['bad-id', ['a'.repeat(24)], { $ne: null }]) {
      await assert.rejects(listMine({ user: { _id: 'student' }, query: { before } }, {}), error => error.status === 400)
    }
    assert.equal(reads, 0)
    await assert.rejects(listMine({ user: { _id: 'student' }, query: { before: 'a'.repeat(24) } }, {}), error => error.status === 404)
  } finally { Notification.findOne = findOne; Notification.find = find }
})
