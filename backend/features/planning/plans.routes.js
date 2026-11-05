import { Router } from 'express';
import * as plans from './plans.controller.js';

const router = Router();

router.get('/', plans.listPlans);
router.post('/', plans.createPlan);
router.put('/:id', plans.updatePlan);
router.delete('/:id', plans.deletePlan);
router.get('/:id/check', plans.checkPlan);

export default router;
