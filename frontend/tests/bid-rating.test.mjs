import test from 'node:test'
import assert from 'node:assert/strict'
import { rateBid } from '../src/core/data/bidding.js'
import { referenceBid } from '../../backend/features/bidding/utils/referenceBid.js'

const row = (median, min) => ({ term: 'AY25/26 T2', round: '1A', median, min })

test('one term of history: the band runs from that term\'s lowest bid to its median', () => {
  const history = [row(40, 20)]
  assert.equal(rateBid(19.99, history).rating, 'at-risk')
  assert.equal(rateBid(20, history).rating, 'competitive')
  assert.equal(rateBid(30, history).rating, 'competitive')
  assert.equal(rateBid(40, history).rating, 'safe')
})

test('the frontend and backend give the same rating for every bid', () => {
  const histories = [
    [row(40, 20)],
    [row(40, 40)],
    [row(40, 55)],
    [row(40)],
    [row(40, 20), row(60, 30)],
    [row(40, 20), row(60, 30), row(35, 10)],
    [row(25, 10), row(25, 12)],
  ]
  for (const history of histories) {
    for (let cents = 1000; cents <= 8000; cents += 125) {
      const amount = cents / 100
      assert.equal(rateBid(amount, history).rating, referenceBid(history, amount).rating, `${amount} against ${JSON.stringify(history)}`)
    }
  }
})
