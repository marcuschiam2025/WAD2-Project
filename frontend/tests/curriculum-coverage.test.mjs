import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

test('explicit course coverage remains required even when the CU target is already met', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  try {
    const { buildCurriculumChecklist } = await server.ssrLoadModule('/src/core/utils/curriculumChecklist.js')
    const { layoutCurriculum } = await server.ssrLoadModule('/src/core/utils/curriculumLayout.js')
    const catalogue = Object.fromEntries(['A', 'B'].map(code => [code, { code, cu: 1 }]))
    for (const rule of ['all', 'chooseN']) {
      const bundle = { majorId: 'IS', tracks: [], requirements: [{ _id: 'R', level: 'major', label: 'Two courses', countsToward: 'MAJOR_CORE', rule, modules: ['A', 'B'], n: 2, cuRequired: 1 }] }
      for (const [past, current, future, options, status] of [
        [['A'], [], [], {}, 'todo'],
        [['A', 'B'], [], [], {}, 'cleared'],
        [['A'], ['B'], [], {}, 'inProgress'],
        [['A'], [], ['B'], {}, 'planned'],
        [[], [], [], { exempted: ['A', 'B'] }, 'exempted'],
      ]) {
        const plan = { majorId: 'IS', tracks: [], currentSem: 'Y2S1', semesters: [{ id: 'Y1S1', modules: past }, { id: 'Y2S1', modules: current }, { id: 'Y2S2', modules: future }] }
        const built = buildCurriculumChecklist(plan, catalogue, bundle, options)
        assert.equal(built.groups[0].slots[0].status, status)
        const laid = layoutCurriculum(built, plan, bundle)
        const row = laid.groups[0].slots[0]
        assert.equal(row.status, status, `${rule}: credit alone must not hide missing or unfinished courses`)
        assert.equal(row.credit.required, 1, 'coverage must not change the configured CU target')
        if (status !== 'todo') {
          assert.match(row.detail, /A, B/, 'the course list must retain every course used to meet coverage')
          if (rule === 'chooseN') assert.match(row.detail, /2 \/ 2 courses/)
        } else assert.equal(laid.groups[0].todo, 1)
        if (status === 'planned') assert.equal(row.semId, 'Y2S2')
        if (status === 'inProgress') assert.equal(row.semId, 'Y2S1')
      }
    }
  } finally { await server.close() }
})
