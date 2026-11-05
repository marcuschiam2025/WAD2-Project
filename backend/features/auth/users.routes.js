import { Router } from 'express';
import { getProfile, updateProfile } from './users.controller.js';

// Mounted at /api/users in routes/index.js, after requireAuth.
const router = Router();

router.get('/me', getProfile); //                          GET   /api/users/me
router.patch('/me', updateProfile); //                     PATCH /api/users/me

export default router;
