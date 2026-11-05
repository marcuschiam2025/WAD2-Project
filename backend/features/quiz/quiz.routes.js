import { Router } from 'express';
import { listQuestionsV2, submitAttemptV2, listAttemptsV2 } from './quiz.v2.controller.js';
import { moduleExplorationV2 } from './quiz.v2.recommendations.js';
import { explanationV2 } from './quiz.v2.explanation.js';

const router = Router();

router.get('/v2/questions', listQuestionsV2);
router.post('/v2/attempts', submitAttemptV2);
router.get('/v2/attempts', listAttemptsV2);
router.get('/v2/attempts/:id/recommendations', moduleExplorationV2);
router.get('/v2/attempts/:id/explanation', explanationV2);

export default router;
