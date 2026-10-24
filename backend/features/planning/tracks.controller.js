import Track from './models/Track.js'
import Requirement from './models/Requirement.js'
import { httpError } from '../../middleware/errorHandler.js'

// GET /api/tracks?major=BSC-IS_AY2025
export async function listTracks(req, res) {
  const filter = {}
  if (req.query.major) {
    filter.majorId = String(req.query.major)
  }

  const tracks = await Track.find(filter).sort({ majorId: 1, trackCode: 1 })
  res.json(tracks)
}

// GET /api/tracks/:id — e.g. BSC-IS_AY2025_BA, with the track's requirements
export async function getTrack(req, res) {
  const track = await Track.findById(req.params.id).lean()
  if (!track) {
    throw httpError(404, 'Track not found')
  }

  const requirements = await Requirement.find({ ownerId: track._id }).sort({ order: 1 })
  res.json({ ...track, requirements: requirements })
}
