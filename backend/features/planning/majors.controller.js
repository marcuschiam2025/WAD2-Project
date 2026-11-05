import Major from './models/Major.js';
import Track from './models/Track.js';
import Requirement from './models/Requirement.js';
import { httpError } from '../../middleware/errorHandler.js';

// Core rules are listed before major rules, then each list follows its own `order`
const LEVEL_RANK = { core: 0, major: 1, track: 2 };

function byLevelThenOrder(a, b) {
  const levelDifference = LEVEL_RANK[a.level] - LEVEL_RANK[b.level];
  if (levelDifference !== 0) {
    return levelDifference;
  }
  return a.order - b.order;
}

// GET /api/majors?school=SCIS
export async function listMajors(req, res) {
  const filter = {};
  if (req.query.school) {
    filter.schoolId = String(req.query.school);
  }

  const majors = await Major.find(filter).sort({ name: 1, intakeFrom: -1 });
  res.json(majors);
}

// GET /api/majors/:id: e.g. BSC-IS_AY2025
export async function getMajor(req, res) {
  const major = await Major.findById(req.params.id);
  if (!major) {
    throw httpError(404, 'Major not found');
  }
  res.json(major);
}

// GET /api/majors/:id/requirements: the major's core + major rules, and each track with its own rules
export async function getRequirements(req, res) {
  const major = await Major.findById(req.params.id);
  if (!major) {
    throw httpError(404, 'Major not found');
  }

  const tracks = await Track.find({ majorId: major._id }).sort({ trackCode: 1 }).lean();

  // Load the rules of the major and of all its tracks in one query
  const ownerIds = [major._id];
  for (const track of tracks) {
    ownerIds.push(track._id);
  }
  const allRequirements = await Requirement.find({ ownerId: { $in: ownerIds } }).lean();

  // Split them back into the major's own rules and each track's rules
  const majorRequirements = allRequirements.filter((requirement) => requirement.ownerId === major._id);
  majorRequirements.sort(byLevelThenOrder);

  const tracksWithRequirements = [];
  for (const track of tracks) {
    const trackRequirements = allRequirements.filter((requirement) => requirement.ownerId === track._id);
    trackRequirements.sort(byLevelThenOrder);
    tracksWithRequirements.push({ ...track, requirements: trackRequirements });
  }

  res.json({
    majorId: major._id,
    totalCU: major.totalCU,
    requirementsAvailable: major.requirementsAvailable,
    requirements: majorRequirements,
    tracks: tracksWithRequirements,
  });
}
