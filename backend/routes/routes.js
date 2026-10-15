import { Router } from 'express';
import { Major } from '../models/index.js';

const router = Router();

router.get('/', async (req, res, next) => {          // GET /api/majors
  try { res.json(await Major.find()); } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {       // GET /api/majors/BSC-IS_AY2025
  try {
    const major = await Major.findById(req.params.id);
    if (!major) return res.status(404).json({ error: 'Major not found' });
    res.json(major);
  } catch (err) { next(err); }
});

export default router;