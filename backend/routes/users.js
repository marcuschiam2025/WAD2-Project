import { Router } from 'express'

const router = Router()

// Fields a student may edit about themselves
const EDITABLE = ['name', 'major', 'intakeYear', 'yearOfStudy', 'tracks', 'completedModules', 'basket', 'consents']

// GET /api/users/me
router.get('/me', (req, res) => {
  res.json(req.user)
})

// PATCH /api/users/me — profile setup step, consents, basket
router.patch('/me', async (req, res) => {
  EDITABLE.forEach((field) => {
    if (req.body[field] !== undefined) req.user[field] = req.body[field]
  })
  await req.user.save()
  res.json(req.user)
})

export default router
