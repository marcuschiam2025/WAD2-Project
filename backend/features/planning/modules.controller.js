import Module from './models/Module.js'
import { httpError } from '../../middleware/errorHandler.js'

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// GET /api/modules?track=BA&category=track&q=analytics
export async function listModules(req, res) {
  const { track, category, q } = req.query
  const filter = {}
  if (track) filter.tracks = String(track).toUpperCase()
  if (category) filter.category = String(category)
  if (q) {
    const re = new RegExp(escapeRegex(String(q)), 'i')
    filter.$or = [{ code: re }, { name: re }]
  }
  res.json(await Module.find(filter).sort({ code: 1 }))
}

// GET /api/modules/:code
export async function getModule(req, res) {
  const mod = await Module.findOne({ code: req.params.code })
  if (!mod) throw httpError(404, 'Module not found')
  res.json(mod)
}
