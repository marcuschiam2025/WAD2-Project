import { Router } from 'express'
import { requireAdmin } from '../../middleware/auth.js'
import { listAudit } from './audit.controller.js'

// Mounted at /api/audit in routes/index.js, after requireAuth
const router = Router()

router.get('/', requireAdmin, listAudit) //   GET /api/audit (admins only)

export default router
