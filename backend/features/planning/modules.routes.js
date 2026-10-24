import { Router } from 'express'
import * as modules from './modules.controller.js'
import { requireAuth, requireAdmin } from '../../middleware/auth.js'

// Mounted at /api/modules before requireAuth: anyone can read the catalogue, only admins change it
const router = Router()

router.get('/', modules.listModules) //                                       GET    /api/modules
router.get('/:code', modules.getModule) //                                    GET    /api/modules/:code
router.post('/', requireAuth, requireAdmin, modules.createModule) //          POST   /api/modules (admins only)
router.patch('/:code', requireAuth, requireAdmin, modules.updateModule) //    PATCH  /api/modules/:code (admins only)
router.delete('/:code', requireAuth, requireAdmin, modules.deleteModule) //   DELETE /api/modules/:code (admins only)

export default router
