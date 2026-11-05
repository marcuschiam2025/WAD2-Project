import { Router } from 'express';
import * as calendar from './calendar.controller.js';

const router = Router();

router.post('/export', calendar.exportTimetable);

export default router;
