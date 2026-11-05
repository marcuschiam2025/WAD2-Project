import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCartItems } from './cartValidation.js'
import { getCart } from '../bidding.controller.js'
import Plan from '../../planning/models/Plan.js'
import BidCart from '../models/BidCart.js'

const items = amounts => amounts.map((amount, i) => ({ module: `M${i}`, sectionId: `M${i}-G1`, amount }))

test('decimal bids can exactly use the balance while one cent over is rejected', () => {
  const cart = items([10.02, 128.30, 71.68])
  assert.equal(validateCartItems(cart, 210), 210)
  assert.equal(validateCartItems(cart, 210.01), 210)
  assert.throws(() => validateCartItems(cart, 209.99), error => error.status === 400 && /more than your balance/.test(error.message))
  assert.equal(validateCartItems(items([10.10, 10.20]), 20.30), 20.30)
  assert.equal(validateCartItems([], 0), 0)
})

test('bids keep their two-decimal, finite-number and minimum-amount constraints', () => {
  for (const amount of [10.001, 10.999, 9.99, -10, NaN, Infinity, '10.02']) {
    assert.throws(() => validateCartItems(items([amount]), 100), error => error.status === 400, String(amount))
  }
  assert.equal(validateCartItems(items([10, 10.01, 10.10]), 100), 30.11)
})

test('reading a saved cart returns the same cent-accurate total without altering bid amounts', async () => {
  const exists = Plan.exists, findOne = BidCart.findOne
  const cart = items([10.02, 128.30, 71.68])
  Plan.exists = async () => true
  BidCart.findOne = async () => ({ items: cart })
  let result
  try {
    await getCart({ user: { _id: 'student', balance: 210 }, query: { planId: 'a'.repeat(24), term: '2026-27_T2' } }, { json: data => { result = data } })
    assert.equal(result.allocated, 210)
    assert.deepEqual(result.items.map(item => item.amount), [10.02, 128.30, 71.68])
  } finally { Plan.exists = exists; BidCart.findOne = findOne }
})
