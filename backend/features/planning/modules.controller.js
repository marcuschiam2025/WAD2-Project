import Module from './models/Module.js'
import Requirement from './models/Requirement.js'
import Plan from './models/Plan.js'
import Section from '../bidding/models/Section.js'
import User from '../auth/models/User.js'
import { recordAudit } from '../audit/audit.service.js'
import { httpError } from '../../middleware/errorHandler.js'

// Escape characters that have a special meaning in a regular expression, e.g. "C++" -> "C\+\+"
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// GET /api/modules?q=analytics&category=IS_TRACK&fulfils=CORE:MANAGING&school=SCIS&limit=20&all=true
// (search= works as an alias for q). Descriptions are left out of the list; fetch one module for it.
// Courses not offered in about 2 years (e.g. COR-IS1702) are hidden unless all=true.
export async function listModules(req, res) {
  const q = req.query.q ?? req.query.search
  const category = req.query.category
  const fulfils = req.query.fulfils
  const school = req.query.school
  const limit = Number(req.query.limit)

  // Build the MongoDB filter from whichever query params were sent
  const filter = {}
  if (req.query.all !== 'true') {
    filter.offeredRecently = { $ne: false }
  }
  if (category) {
    filter.categories = String(category)
  }
  if (fulfils) {
    filter.fulfils = String(fulfils)
  }
  if (school) {
    filter.schoolId = String(school)
  }
  if (q) {
    // Match the text anywhere in the code or the title, ignoring case
    const pattern = new RegExp(escapeRegex(String(q)), 'i')
    filter.$or = [{ _id: pattern }, { title: pattern }]
  }

  const query = Module.find(filter, { description: 0 }).sort({ _id: 1 })
  if (limit > 0) {
    query.limit(limit)
  }

  const modules = await query
  res.json(modules)
}

// GET /api/modules/:code
export async function getModule(req, res) {
  const mod = await Module.findById(req.params.code)
  if (!mod) {
    throw httpError(404, 'Module not found')
  }
  res.json(mod)
}

// ---------------------------------------------------------------------------------------------
// Admin only (requireAdmin in modules.routes.js). Every change is logged (see features/audit). Note: `pnpm seed` rebuilds the catalogue from
// data/modules.json, so changes made here are replaced the next time the database is reseeded.
// ---------------------------------------------------------------------------------------------

// A course code: IS213, COR-IS1704, ACCT201A, LAW101_601
const CODE_PATTERN = /^[A-Z]+(-[A-Z]+)?\d+[A-Z]?(_\d+)?$/

// Fields an admin may set on a module (the code itself can't change once created)
const MODULE_FIELDS = [
  'title',
  'cu',
  'schoolId',
  'department',
  'description',
  'categories',
  'fulfils',
  'prerequisites',
  'corequisites',
  'mutuallyExclusive',
  'prerequisiteRules',
  'requisiteNotes',
  'termsOffered',
  'lastOffered',
  'offeredRecently',
]

function copyFields(body, fields, target) {
  for (const field of fields) {
    if (body[field] !== undefined) {
      target[field] = body[field]
    }
  }
}

// Requisites must be AND-of-OR groups of course codes: [["IS112", "IS105"], ["IS113"]]
function checkGroups(value, name) {
  if (value === undefined) return
  const valid = Array.isArray(value) && value.every((group) => Array.isArray(group) && group.every((code) => typeof code === 'string'))
  if (!valid) {
    throw httpError(400, `${name} must be a list of groups of course codes, e.g. [["IS112","IS105"],["IS113"]]`)
  }
}

// POST /api/modules { code, title, cu, ... }
export async function createModule(req, res) {
  const code = String(req.body.code ?? req.body._id ?? '').trim().toUpperCase()
  if (!CODE_PATTERN.test(code)) {
    throw httpError(400, 'code must be a course code like IS213 or COR-IS1704')
  }
  checkGroups(req.body.prerequisites, 'prerequisites')
  checkGroups(req.body.corequisites, 'corequisites')

  const mod = new Module({ _id: code })
  copyFields(req.body, MODULE_FIELDS, mod)
  await mod.save() // an existing code gives 409 Duplicate value
  await recordAudit(req.user, 'create', 'modules', mod._id, null, mod)
  res.status(201).json(mod)
}

// PATCH /api/modules/:code { title?, cu?, prerequisites?, ... } — only the fields sent change
export async function updateModule(req, res) {
  const mod = await Module.findById(req.params.code)
  if (!mod) {
    throw httpError(404, 'Module not found')
  }
  checkGroups(req.body.prerequisites, 'prerequisites')
  checkGroups(req.body.corequisites, 'corequisites')

  const before = mod.toObject()
  copyFields(req.body, MODULE_FIELDS, mod)
  await mod.save()
  await recordAudit(req.user, 'update', 'modules', mod._id, before, mod)
  res.json(mod)
}

// DELETE /api/modules/:code — refused while anything still uses the module.
// For a course that has stopped running, PATCH { offeredRecently: false } instead.
export async function deleteModule(req, res) {
  const code = req.params.code
  const mod = await Module.findById(code)
  if (!mod) {
    throw httpError(404, 'Module not found')
  }

  // Exchange mappings are stored as "CS412 → IS460", so match the code on either side
  const inPlan = new RegExp(`(^|→ )${escapeRegex(code)}$|^${escapeRegex(code)} →`)
  const [sections, requirements, plans, users] = await Promise.all([
    Section.countDocuments({ module: code }),
    Requirement.countDocuments({ modules: code }),
    Plan.countDocuments({ 'semesters.modules': inPlan }),
    User.countDocuments({ $or: [{ completedModules: code }, { basket: code }] }),
  ])

  const usedBy = []
  if (sections > 0) usedBy.push(`${sections} sections`)
  if (requirements > 0) usedBy.push(`${requirements} graduation requirements`)
  if (plans > 0) usedBy.push(`${plans} plans`)
  if (users > 0) usedBy.push(`${users} students' completed modules or basket`)
  if (usedBy.length > 0) {
    throw httpError(409, `${code} is still used by ${usedBy.join(', ')}. Mark it offeredRecently: false instead.`)
  }

  await mod.deleteOne()
  await recordAudit(req.user, 'delete', 'modules', code, mod, null)
  res.status(204).end()
}
