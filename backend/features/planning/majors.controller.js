import Major from './models/Major.js'
import { httpError } from '../../middleware/errorHandler.js'

// GET /api/majors
export async function listMajors(req, res) {
  res.json(await Major.find())
}

// GET /api/majors/:id — e.g. BSC-IS_AY2025
export async function getMajor(req, res) {
  const major = await Major.findById(req.params.id)
  if (!major) throw httpError(404, 'Major not found')
  res.json(major)
}
