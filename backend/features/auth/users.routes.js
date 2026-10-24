import { Router } from 'express'
import { requireAdmin } from '../../middleware/auth.js'
import { getProfile, updateProfile, adminCheck } from './users.controller.js'

// Mounted at /api/users in routes/index.js, after requireAuth.
const router = Router()

router.get('/me', getProfile) //                          GET   /api/users/me
router.patch('/me', updateProfile) //                     PATCH /api/users/me
router.get('/admin-check', requireAdmin, adminCheck) //   GET   /api/users/admin-check (admins only)

export default router
