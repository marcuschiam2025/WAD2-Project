import { Router } from 'express'
import mongoose from 'mongoose'
import { requireAdmin } from '../../middleware/admin.js'
import { httpError } from '../../middleware/errorHandler.js'
import AuditEntry from './models/AuditEntry.js'

import { listAdminModules, getAdminModule, createAdminModule, updateAdminModule, archiveAdminModule, restoreAdminModule, deleteAdminModule } from './modules.controller.js'

import { listAdminSections, createAdminSection, updateAdminSection, archiveAdminSection, restoreAdminSection } from './sections.controller.js'

import { listAdminCurricula, getAdminCurriculum, updateAdminTrack, updateAdminRequirement } from './curricula.controller.js'

import { getAdminRound, saveAdminRound } from './rounds.controller.js'

const router = Router()
router.use(requireAdmin)
router.get('/', (req, res) => res.json({ role: req.user.role, name: req.user.name || req.user.email }))
router.get('/modules', listAdminModules)
router.get('/modules/:code', getAdminModule)
router.post('/modules', createAdminModule)
router.put('/modules/:code', updateAdminModule)
router.post('/modules/:code/archive', archiveAdminModule)
router.post('/modules/:code/restore', restoreAdminModule)
router.delete('/modules/:code', deleteAdminModule)
router.get('/sections', listAdminSections)
router.post('/sections', createAdminSection)
router.put('/sections/:term/:code/:section', updateAdminSection)
router.post('/sections/:term/:code/:section/archive', archiveAdminSection)
router.post('/sections/:term/:code/:section/restore', restoreAdminSection)
router.get('/curricula', listAdminCurricula)
router.get('/curricula/:id', getAdminCurriculum)
router.put('/curricula/:id/tracks/:record', updateAdminTrack)
router.put('/curricula/:id/requirements/:record', updateAdminRequirement)
router.get('/bidding-round', getAdminRound)
router.put('/bidding-round', saveAdminRound)
router.get('/audit', async (req, res) => {
  const { before } = req.query
  if (before !== undefined && (typeof before !== 'string' || !/^[a-f\d]{24}$/i.test(before))) throw httpError(400, 'Invalid history cursor')
  const entries = await AuditEntry.find(before ? { _id: { $lt: new mongoose.Types.ObjectId(before) } } : {})
    .sort({ _id: -1 }).limit(26).select('-before -after').lean()
  const page = entries.slice(0, 25)
  res.json({ entries: page, next: entries.length > 25 ? String(page.at(-1)._id) : null })
})
export default router
