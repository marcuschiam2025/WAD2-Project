import { Router } from 'express'
import usersRouter from '../features/auth/users.routes.js'
import modulesRouter from '../features/planning/modules.routes.js'
import tracksRouter from '../features/planning/tracks.routes.js'
import majorsRouter from '../features/planning/majors.routes.js'
import plansRouter from '../features/planning/plans.routes.js'
import quizRouter from '../features/quiz/quiz.routes.js'
import biddingRouter from '../features/bidding/bidding.routes.js'
import partiesRouter from '../features/parties/parties.routes.js'
import calendarRouter from '../features/calendar/calendar.routes.js'
import adminRouter from '../features/admin/admin.routes.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/health', (req, res) => res.json({ ok: true }))

// Public catalogue data
router.use('/modules', modulesRouter)
router.use('/tracks', tracksRouter)
router.use('/majors', majorsRouter)

// Everything below needs a signed-in student (requireAuth sets req.user)
router.use(requireAuth)
router.use('/admin', adminRouter)
router.use('/users', usersRouter)
router.use('/plans', plansRouter)
router.use('/quiz', quizRouter)
router.use('/bidding', biddingRouter)
router.use('/parties', partiesRouter)
router.use('/calendar', calendarRouter)

export default router
