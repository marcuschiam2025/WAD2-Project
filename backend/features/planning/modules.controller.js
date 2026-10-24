import Module from './models/Module.js'
import { httpError } from '../../middleware/errorHandler.js'

// Escape characters that have a special meaning in a regular expression, e.g. "C++" -> "C\+\+"
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// GET /api/modules?q=analytics&category=IS_TRACK&fulfils=CORE:MANAGING&school=SCIS&limit=20
// (search= works as an alias for q). Descriptions are left out of the list; fetch one module for it.
export async function listModules(req, res) {
  const q = req.query.q ?? req.query.search
  const category = req.query.category
  const fulfils = req.query.fulfils
  const school = req.query.school
  const limit = Number(req.query.limit)

  // Build the MongoDB filter from whichever query params were sent
  const filter = req.query.includeArchived === 'true' ? {} : { archived: { $ne: true } }
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
