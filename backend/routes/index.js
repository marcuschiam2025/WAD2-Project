import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import usersRouter from './users.js'
import tracksRouter from './tracks.js'
import modulesRouter from './modules.js'
import quizRouter from './quiz.js'
import plansRouter from './plans.js'
import roomsRouter from './rooms.js'
import biddingRouter from './bidding.js'
import calendarRouter from './calendar.js'

const router = Router()

router.get('/health', (req, res) => res.json({ ok: true }))

// Public catalogue data
router.use('/tracks', tracksRouter)
router.use('/modules', modulesRouter)

// Everything below needs a signed-in student
router.use(requireAuth)
router.use('/users', usersRouter)
router.use('/quiz', quizRouter)
router.use('/plans', plansRouter)
router.use('/rooms', roomsRouter)
router.use('/bidding', biddingRouter)
router.use('/calendar', calendarRouter)

export default router
