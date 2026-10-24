import test from 'node:test'
import assert from 'node:assert/strict'
import Section from './models/Section.js'
import { loadSections, roundSettings } from './section.repository.js'

test('repository reads shared sections by canonical ID and exposes catalogue fallback without a fabricated deadline', async () => {
  const original = { distinct: Section.collection.distinct, find: Section.collection.find }
  const filters = []
  Section.collection.distinct = async key => key === 'termKey' ? ['2026-27_T1'] : []
  Section.collection.find = filter => {
    filters.push(filter)
    return { toArray: async () => [{ moduleCode:'IS216',termKey:'2026-27_T1',sectionCode:'G11',instructor:'Test',classSlots:[{day:'THU',start:'12:00',end:'13:30'},{day:'FRI',start:'12:00',end:'13:30'}],finalExam:null }] }
  }
  try {
    assert.deepEqual(await roundSettings({}), { term:'2026-27_T1',round:null,closesAt:null,availableTerms:['2026-27_T1'],configured:false,source:'catalogue' })
    const configured = await roundSettings({BIDDING_TERM:'AY26/27 T1',BIDDING_ROUND:'1A',BIDDING_ROUND_CLOSES_AT:'2026-10-30T12:00:00+08:00'})
    assert.equal(configured.closesAt,'2026-10-30T04:00:00.000Z')
    assert.equal(configured.configured,true)
    const rows = await loadSections({term:'2026-27_T1',ids:['2026-27_T1:IS216:G11']})
    assert.equal(rows[0].sessions.length,2)
    assert.ok(JSON.stringify(filters[0]).includes('sectionCode'))
    await assert.rejects(roundSettings({BIDDING_ROUND_CLOSES_AT:'bad'}), /Invalid/)
  } finally {
    Object.assign(Section.collection,original)
  }
})
