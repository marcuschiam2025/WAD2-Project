import { Router } from 'express'
import * as notifications from './notifications.controller.js'

const router = Router()

// Fixed paths first, then the one with :id
router.get('/', notifications.listMine)
router.get('/unread-count', notifications.unreadCount)
router.patch('/read-all', notifications.markAllRead)
router.patch('/:id/read', notifications.markRead)

export default router