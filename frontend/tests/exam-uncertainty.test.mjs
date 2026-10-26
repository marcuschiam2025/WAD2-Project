import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { normalizeSection } from '../../backend/features/bidding/utils/sectionData.js'
import { toSectionView } from '../../backend/features/bidding/utils/sectionView.js'
import { findExamClashes as serverClashes } from '../../backend/features/bidding/utils/clash.js'

const raw = { sectionId: 'IS216-G1', module: 'IS216', section: 'G1', term: 'AY26/27 T2', meetings: [], examSource: 'boss', finalExam: { date: '2027-04-19T16:00:00.000Z', start: '09:00', end: '11:00' } }

test('frontend and backend agree on definite clashes without assuming unknown exam durations', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { findExamClashes } = await server.ssrLoadModule('/src/core/utils/clash.js')
    const a = toSectionView(normalizeSection(raw))
    const b = { ...a, id: 'B', examPeriod: { date: '2027-04-20', start: '10:00', end: null } }
    const same = { ...b, examPeriod: { ...b.examPeriod, start: '09:00' } }
    const covering = { ...b, examPeriod: { ...b.examPeriod, start: '08:30', end: '09:30' } }
    assert.equal(findExamClashes([a, same]).length, 1, 'same starts prove overlap even if ends are unconfirmed')
    assert.equal(findExamClashes([a, b]).length, 0, 'an unconfirmed end cannot prove overlap with a later start')
    for (const pair of [[a, b], [a, same], [a, covering]]) assert.deepEqual(findExamClashes(pair), serverClashes(pair))
  } finally { await server.close() }
})

test('the exam schedule shows known starts and clearly marks unconfirmed ends', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: Schedule } = await server.ssrLoadModule('/src/components/ExamSchedule.vue')
    const html = await renderToString(createSSRApp(Schedule, { sections: [toSectionView(normalizeSection(raw))] }))
    assert.match(html, /09:00/)
    assert.match(html, /End time unconfirmed/i)
    assert.match(html, /cannot rule out/i)
    assert.doesNotMatch(html, /assume 2-hour|09:00–11:00|09:00–null/)
  } finally { await server.close() }
})
