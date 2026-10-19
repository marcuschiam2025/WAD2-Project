import { Router } from 'express'
import * as users from './users.controller.js'

const router = Router()

router.get('/me', users.getMe)
router.patch('/me', users.updateMe)

export default router
