import test from 'node:test'
import assert from 'node:assert/strict'

test('room decision counts current members with valid choices, exposes ties and stale confirmations', async () => {
  const { decisionSummary } = await import('./utils/decision.js').catch(() => ({}))
  assert.equal(typeof decisionSummary, 'function', 'shared decision rules are required')
  const party = { members: ['a', 'b'], votes: [{ user: 'a', sectionIds: ['g1', 'g2'] }, { user: 'former', sectionIds: ['g1'] }], finalisedSection: 'g1' }
  let result = decisionSummary(party, ['g1', 'g2'])
  assert.equal(result.votedCount, 1); assert.deepEqual(result.waitingIds, ['b']); assert.equal(result.finalisedSection, null)
  party.votes.push({ user: 'b', sectionIds: ['g2', 'g1'] })
  result = decisionSummary(party, ['g1', 'g2'])
  assert.equal(result.allVoted, true); assert.deepEqual(result.leaders, ['g1', 'g2']); assert.equal(result.tie, true)
  assert.equal(result.finalisedSection, 'g1')
  assert.equal(decisionSummary(party, []).allVoted, false)
  party.votes = [{ user: 'a', sectionIds: ['g1'] }, { user: 'a', sectionIds: ['g1'] }, { user: 'b', sectionIds: [] }]
  assert.equal(decisionSummary(party, ['g1']).votedCount, 1)
})
