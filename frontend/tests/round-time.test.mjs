import test from 'node:test'
import assert from 'node:assert/strict'
import { singaporeInput, singaporeInstant } from '../src/core/utils/roundTime.js'
test('staff closing times round-trip in Singapore time regardless of computer timezone', () => {
  assert.equal(singaporeInput('2026-11-01T04:00:00.000Z'), '2026-11-01T12:00')
  assert.equal(singaporeInstant('2026-11-01T12:00'), '2026-11-01T12:00:00+08:00')
  assert.equal(singaporeInput(null), '')
  assert.throws(() => singaporeInstant('bad'), /closing time/)
})
