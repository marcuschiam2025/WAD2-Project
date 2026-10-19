import Plan, { MAX_PLANS } from './models/Plan.js'
import Module from './models/Module.js'
import { checkPlan as checkRequirements } from './utils/requirementChecker.js'
import { httpError } from '../../middleware/errorHandler.js'

const EDITABLE = ['name', 'tracks', 'currentSem', 'semesters']

async function findOwnPlan(req) {
  const plan = await Plan.findOne({ _id: req.params.id, user: req.user._id })
  if (!plan) throw httpError(404, 'Plan not found')
  return plan
}

// GET /api/plans
export async function listPlans(req, res) {
  res.json(await Plan.find({ user: req.user._id }).sort({ createdAt: 1 }))
}

// POST /api/plans — max 3 per student
export async function createPlan(req, res) {
  const count = await Plan.countDocuments({ user: req.user._id })
  if (count >= MAX_PLANS) throw httpError(409, `You can create up to ${MAX_PLANS} plans. Delete one first.`)
  const data = Object.fromEntries(EDITABLE.filter((f) => req.body[f] !== undefined).map((f) => [f, req.body[f]]))
  const plan = await Plan.create({ ...data, name: data.name ?? `Plan ${count + 1}`, user: req.user._id })
  res.status(201).json(plan)
}

// GET /api/plans/:id
export async function getPlan(req, res) {
  res.json(await findOwnPlan(req))
}

// PUT /api/plans/:id — save the whole plan after drag-and-drop edits
export async function updatePlan(req, res) {
  const plan = await findOwnPlan(req)
  EDITABLE.forEach((f) => {
    if (req.body[f] !== undefined) plan[f] = req.body[f]
  })
  await plan.save()
  res.json(plan)
}

// DELETE /api/plans/:id
export async function deletePlan(req, res) {
  const plan = await findOwnPlan(req)
  await plan.deleteOne()
  res.status(204).end()
}

// GET /api/plans/:id/check — CU per requirement bucket + prereq/coreq warnings
export async function checkPlan(req, res) {
  const plan = await findOwnPlan(req)
  const modules = await Module.find().lean()
  const catalogue = Object.fromEntries(modules.map((m) => [m.code, m]))
  res.json(checkRequirements(plan, catalogue))
}
