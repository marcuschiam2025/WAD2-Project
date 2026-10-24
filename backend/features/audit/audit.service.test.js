import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changedFields } from './audit.service.js'

test('changedFields lists edited fields, ignoring ids and the version counter', () => {
  const before = { _id: 'IS213', __v: 0, title: 'Old', cu: 1, prerequisites: [['IS112']] }
  const after = { _id: 'IS213', __v: 1, title: 'New', cu: 1, prerequisites: [['IS112'], ['IS113']], description: 'added' }
  assert.deepEqual(changedFields(before, after), ['title', 'prerequisites', 'description'])
  assert.deepEqual(changedFields(before, { ...before, __v: 3 }), [])
})
