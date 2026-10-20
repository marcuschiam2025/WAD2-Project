import { Router } from 'express'
import * as quiz from './quiz.controller.js'
import { listQuestionsV2, submitAttemptV2, listAttemptsV2 } from './quiz.v2.controller.js'
import { moduleExplorationV2 } from './quiz.v2.recommendations.js'

const router = Router()

router.get('/questions', quiz.listQuestions)
router.get('/v2/questions', listQuestionsV2)
router.post('/v2/attempts', submitAttemptV2)
router.get('/v2/attempts', listAttemptsV2)
router.get('/v2/attempts/:id/recommendations', moduleExplorationV2)
router.post('/attempts', quiz.submitAttempt)
router.get('/attempts', quiz.listAttempts)
router.get('/attempts/:id/recommendations', quiz.getRecommendations)

export default router
