import { Router } from 'express';
import SecondMajor from './models/SecondMajor.js';

const router = Router();

// GET /api/second-majors
router.get('/', async (req, res) => {
  res.json(await SecondMajor.find().sort({ name: 1 }).lean());
});

export default router;
