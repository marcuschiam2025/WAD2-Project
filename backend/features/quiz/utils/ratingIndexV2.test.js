import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateThemeRating } from './ratingIndexV2.js'

test('reproduces the approved weighted example', () => {
  assert.deepEqual(calculateThemeRating([{ value: 5, weight: 30 }, { value: 2, weight: 15 }]), {
    index: 75,
    informativeCount: 2,
  })
})

test('unsure and skipped answers do not add weight or imply zero alignment', () => {
  assert.deepEqual(calculateThemeRating([{ value: 3, weight: 30 }, { value: null, weight: 15 }]), {
    index: null,
    informativeCount: 0,
  })
  assert.deepEqual(calculateThemeRating([]), { index: null, informativeCount: 0 })
  assert.deepEqual(calculateThemeRating([{ value: 3, weight: 30 }, { value: 1, weight: 15 }]), {
    index: 0,
    informativeCount: 1,
  })
})

test('rating anchors span 0–100 and calculation keeps fractional precision', () => {
  for (const [value, index] of [[1, 0], [2, 25], [4, 75], [5, 100]]) {
    assert.equal(calculateThemeRating([{ value, weight: 35 }]).index, index)
  }
  assert.equal(calculateThemeRating([{ value: 4, weight: 20 }, { value: 2, weight: 15 }]).index, 1875 / 35)
})

test('rejects invalid ratings and weights instead of coercing them', () => {
  for (const value of [undefined, '5', 0, 6, 2.5, NaN]) {
    assert.throws(() => calculateThemeRating([{ value, weight: 30 }]), TypeError)
  }
  for (const weight of [undefined, '30', 0, -1, Infinity, NaN]) {
    assert.throws(() => calculateThemeRating([{ value: 5, weight }]), TypeError)
  }
  assert.throws(() => calculateThemeRating(null), TypeError)
  assert.throws(() => calculateThemeRating([null]), TypeError)
})
