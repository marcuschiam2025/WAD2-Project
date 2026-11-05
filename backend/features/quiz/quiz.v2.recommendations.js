import mongoose from 'mongoose';
import QuizAttempt from './models/QuizAttempt.js';
import { loadSharedCatalogueV2 } from './utils/sharedCatalogueV2.js';
import { recommendExplorationModules } from './utils/moduleExplorationV2.js';

export function createModuleExplorationV2(
  findAttempt = (filter) => QuizAttempt.findOne(filter),
  loadCatalogue = loadSharedCatalogueV2,
) {
  return async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ error: 'Invalid attempt ID', code: 'INVALID_ATTEMPT_ID' });
    }
    const attempt = await findAttempt({ _id: req.params.id, user: req.user._id });
    if (!attempt) return res.status(404).json({ error: 'Attempt not found', code: 'QUIZ_ATTEMPT_NOT_FOUND' });
    if (!attempt.resultSnapshot) {
      return res
        .status(409)
        .json({ error: 'Retake the current quiz for module exploration', code: 'LEGACY_QUIZ_ATTEMPT' });
    }
    res.set('Cache-Control', 'no-store');
    const catalogue = await loadCatalogue(attempt, req.user);
    return res.json(recommendExplorationModules(attempt, catalogue, req.user));
  };
}

export const moduleExplorationV2 = createModuleExplorationV2();
