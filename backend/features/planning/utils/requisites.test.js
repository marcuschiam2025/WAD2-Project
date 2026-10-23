import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRequisite, splitCodes, unmetGroups } from './requisites.js'

test('"/" is or: one group', () => {
  assert.deepEqual(parseRequisite('IS217/MGMT108/COR-STAT1202'), [['IS217', 'MGMT108', 'COR-STAT1202']])
})

test('short codes reuse the previous subject', () => {
  assert.deepEqual(parseRequisite('ACCT101/103/111'), [['ACCT101', 'ACCT103', 'ACCT111']])
  assert.deepEqual(parseRequisite('ACCT201/201A'), [['ACCT201', 'ACCT201A']])
})

test('"&" is and: one group per side', () => {
  assert.deepEqual(parseRequisite('CS101 & CS103'), [['CS101'], ['CS103']])
})

test('an and-group inside an or is spread into groups', () => {
  assert.deepEqual(parseRequisite('IS111/(CS101&CS201)'), [
    ['IS111', 'CS101'],
    ['IS111', 'CS201'],
  ])
})

test('"/" binds tighter than "&"', () => {
  assert.deepEqual(parseRequisite('CS103&IS217/MGMT108'), [['CS103'], ['IS217', 'MGMT108']])
})

test('unreadable tokens are dropped', () => {
  assert.deepEqual(parseRequisite('(CS103&5&201)'), [['CS103'], ['CS201']])
  assert.deepEqual(parseRequisite(''), [])
})

test('splitCodes and unmetGroups', () => {
  assert.deepEqual(splitCodes('STAT151/COR-STAT1203'), ['STAT151', 'COR-STAT1203'])
  assert.deepEqual(unmetGroups([['IS111', 'CS101'], ['IS217']], (c) => c === 'CS101'), [['IS217']])
})
