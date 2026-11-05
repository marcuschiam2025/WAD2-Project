import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBalance } from '../src/core/utils/balance.js'

test('only a real number of 0 or more becomes a balance', () => {
  assert.equal(parseBalance('12.345'), 12.35)
  assert.equal(parseBalance(' 100 '), 100)
  assert.equal(parseBalance('0'), 0, 'an explicit zero is allowed')
  for (const bad of ['', '   ', 'abc', '12abc', '-5', null, undefined]) assert.equal(parseBalance(bad), null, String(bad))
})
