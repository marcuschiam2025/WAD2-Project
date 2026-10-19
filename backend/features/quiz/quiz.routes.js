import { Router } from 'express'
import * as quiz from './quiz.controller.js'

const router = Router()

router.get('/questions', quiz.listQuestions)
router.post('/attempts', quiz.submitAttempt)
router.get('/attempts', quiz.listAttempts)
router.get('/attempts/:id/recommendations', quiz.getRecommendations)

export default router
