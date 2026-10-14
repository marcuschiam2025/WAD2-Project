import { Router } from 'express'
import Plan, { MAX_PLANS } from '../models/Plan.js'
import Module from '../models/Module.js'
import { checkPlan } from '../utils/requirementChecker.js'
import { httpError } from '../middleware/errorHandler.js'

const router = Router()

const EDITABLE = ['name', 'tracks', 'currentSem', 'semesters']

async function findOwnPlan(req) {
  const plan = await Plan.findOne({ _id: req.params.id, user: req.user._id })
  if (!plan) throw httpError(404, 'Plan not found')
  return plan
}

// GET /api/plans
router.get('/', async (req, res) => {
  res.json(await Plan.find({ user: req.user._id }).sort({ createdAt: 1 }))
})

// POST /api/plans — max 3 per student
router.post('/', async (req, res) => {
  const count = await Plan.countDocuments({ user: req.user._id })
  if (count >= MAX_PLANS) throw httpError(409, `You can create up to ${MAX_PLANS} plans. Delete one first.`)
  const data = Object.fromEntries(EDITABLE.filter((f) => req.body[f] !== undefined).map((f) => [f, req.body[f]]))
  const plan = await Plan.create({ ...data, name: data.name ?? `Plan ${count + 1}`, user: req.user._id })
  res.status(201).json(plan)
})

// GET /api/plans/:id
router.get('/:id', async (req, res) => {
  res.json(await findOwnPlan(req))
})

// PUT /api/plans/:id — save the whole plan after drag-and-drop edits
router.put('/:id', async (req, res) => {
  const plan = await findOwnPlan(req)
  EDITABLE.forEach((f) => {
    if (req.body[f] !== undefined) plan[f] = req.body[f]
  })
  await plan.save()
  res.json(plan)
})

// DELETE /api/plans/:id
router.delete('/:id', async (req, res) => {
  const plan = await findOwnPlan(req)
  await plan.deleteOne()
  res.status(204).end()
})

// GET /api/plans/:id/check — CU per requirement bucket + prereq/coreq warnings
router.get('/:id/check', async (req, res) => {
  const plan = await findOwnPlan(req)
  const modules = await Module.find().lean()
  const catalogue = Object.fromEntries(modules.map((m) => [m.code, m]))
  res.json(checkPlan(plan, catalogue))
})

export default router
