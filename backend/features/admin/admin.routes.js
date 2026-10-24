import { Router } from 'express'
import mongoose from 'mongoose'
import { requireAdmin } from '../../middleware/admin.js'
import { httpError } from '../../middleware/errorHandler.js'
import AuditEntry from './models/AuditEntry.js'

const router = Router()
router.use(requireAdmin)
router.get('/', (req, res) => res.json({ role: req.user.role, name: req.user.name || req.user.email }))
router.get('/audit', async (req, res) => {
  const { before } = req.query
  if (before !== undefined && (typeof before !== 'string' || !/^[a-f\d]{24}$/i.test(before))) throw httpError(400, 'Invalid history cursor')
  const entries = await AuditEntry.find(before ? { _id: { $lt: new mongoose.Types.ObjectId(before) } } : {})
    .sort({ _id: -1 }).limit(26).select('-before -after').lean()
  const page = entries.slice(0, 25)
  res.json({ entries: page, next: entries.length > 25 ? String(page.at(-1)._id) : null })
})
export default router
