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

test('the exam schedule shows dates and start times without end-time warnings', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { default: Schedule } = await server.ssrLoadModule('/src/components/ExamSchedule.vue')
    const section = toSectionView(normalizeSection(raw))
    const html = await renderToString(createSSRApp(Schedule, { sections: [section, { ...section, id: 'afternoon', module: 'IS213', examPeriod: { ...section.examPeriod, start: '13:00', end: '15:00' } }] }))
    assert.match(html, /09:00/)
    assert.match(html, /13:00/)
    assert.match(html, /same day/)
    assert.match(html, /Check the official exam schedule/)
    assert.doesNotMatch(html, /End time unconfirmed|cannot rule out|15:00|09:00–null|· clash/)
    const clashing = await renderToString(createSSRApp(Schedule, { sections: [section, { ...section, id: 'simultaneous', module: 'IS213' }] }))
    assert.match(clashing, /· clash/, 'simultaneous exams must still be flagged')
  } finally { await server.close() }
})
