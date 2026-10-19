import Track from './models/Track.js'
import { httpError } from '../../middleware/errorHandler.js'

// GET /api/tracks?intake=2023
export async function listTracks(req, res) {
  const filter = req.query.intake ? { intake: Number(req.query.intake) } : {}
  res.json(await Track.find(filter).sort({ code: 1 }))
}

// GET /api/tracks/:code?intake=2023
export async function getTrack(req, res) {
  const filter = { code: req.params.code.toUpperCase() }
  if (req.query.intake) filter.intake = Number(req.query.intake)
  const track = await Track.findOne(filter).sort({ intake: -1 })
  if (!track) throw httpError(404, 'Track not found')
  res.json(track)
}
