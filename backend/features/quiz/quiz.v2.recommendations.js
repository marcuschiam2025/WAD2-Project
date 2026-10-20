import mongoose from 'mongoose'
import { readFile } from 'node:fs/promises'
import QuizAttempt from './models/QuizAttempt.js'
import { recommendExplorationModules } from './utils/moduleExplorationV2.js'

const catalogue = JSON.parse(await readFile(new URL('./content/modules.ay2025.json', import.meta.url), 'utf8'))

export function createModuleExplorationV2(findAttempt = (filter) => QuizAttempt.findOne(filter)) {
  return async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({ error: 'Invalid attempt ID', code: 'INVALID_ATTEMPT_ID' })
    }
    const attempt = await findAttempt({ _id: req.params.id, user: req.user._id })
    if (!attempt) return res.status(404).json({ error: 'Attempt not found', code: 'QUIZ_ATTEMPT_NOT_FOUND' })
    if (!attempt.resultSnapshot) {
      return res.status(409).json({ error: 'Retake the current quiz for module exploration', code: 'LEGACY_QUIZ_ATTEMPT' })
    }
    res.set('Cache-Control', 'no-store')
    return res.json(recommendExplorationModules(attempt, catalogue, req.user))
  }
}

export const moduleExplorationV2 = createModuleExplorationV2()
