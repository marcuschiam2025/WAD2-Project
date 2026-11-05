import Major from '../planning/models/Major.js';
import Track from '../planning/models/Track.js';
import Requirement from '../planning/models/Requirement.js';
import Module from '../planning/models/Module.js';
import { auditedChange } from './audit.service.js';
import { revisionFilter } from './changes.js';
import { createCurriculumEditor, curriculumId } from './curricula.service.js';
import { httpError } from '../../middleware/errorHandler.js';

const editor = createCurriculumEditor({
  change: auditedChange,
  major: (id, session) => Major.findById(id).session(session).lean(),
  track: (id, session) => Track.findById(id).session(session).lean(),
  requirement: (id, session) => Requirement.findById(id).session(session).lean(),
  modules: (codes, session) =>
    Module.find({ _id: { $in: codes } })
      .select('_id archived')
      .session(session)
      .lean(),
  update: (kind, before, data, session) =>
    (kind === 'track' ? Track : Requirement)
      .findOneAndUpdate(
        revisionFilter(before._id, before.revision ?? 0),
        { $set: data, $inc: { revision: 1 } },
        { new: true, runValidators: true, session },
      )
      .lean(),
});
export async function listAdminCurricula(_req, res) {
  res.json(
    await Major.find({})
      .select('_id degreeName name intakeFrom intakeTo requirementsAvailable')
      .sort({ degreeName: 1, name: 1, intakeFrom: -1 })
      .lean(),
  );
}
export async function getAdminCurriculum(req, res) {
  const major = await Major.findById(curriculumId(req.params.id)).lean();
  if (!major) throw httpError(404, 'Curriculum not found');
  const tracks = await Track.find({ majorId: major._id }).sort({ trackCode: 1 }).lean();
  const requirements = await Requirement.find({
    ownerId: { $in: [major._id, ...tracks.map((track) => track._id)] },
  })
    .sort({ level: 1, order: 1, _id: 1 })
    .lean();
  res.json({
    major,
    tracks: tracks.map((row) => ({ ...row, revision: row.revision ?? 0 })),
    requirements: requirements.map((row) => ({ ...row, revision: row.revision ?? 0 })),
  });
}
export async function updateAdminTrack(req, res) {
  res.json(await editor.save(req.user, req.params.id, 'track', req.params.record, req.body));
}
export async function updateAdminRequirement(req, res) {
  res.json(await editor.save(req.user, req.params.id, 'requirement', req.params.record, req.body));
}
