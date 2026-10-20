import QuizQuestion from './models/QuizQuestion.js'
import QuizAttempt from './models/QuizAttempt.js'
import Track from '../planning/models/Track.js'
import Module from '../planning/models/Module.js'
import Requirement from '../planning/models/Requirement.js'
import { unmetGroups } from '../planning/utils/requisites.js'
import { scoreQuiz } from './utils/trackScoring.js'
import { httpError } from '../../middleware/errorHandler.js'

// Only the latest attempts are stored; a new attempt overlays the oldest.
const MAX_ATTEMPTS = 2

// GET /api/quiz/questions — weights are server-side only
export async function listQuestions(req, res) {
  const questions = await QuizQuestion.find().sort({ order: 1 }).select('-options.weights')
  res.json(questions)
}

// POST /api/quiz/attempts { answers: [optionIndex | null, ...] }
export async function submitAttempt(req, res) {
  const { answers } = req.body
  const questions = await QuizQuestion.find().sort({ order: 1 })
  if (!Array.isArray(answers) || answers.length !== questions.length) {
    throw httpError(400, `answers must be an array of ${questions.length} option indexes`)
  }

  const results = scoreQuiz(questions, answers)
  const attempt = await QuizAttempt.create({ user: req.user._id, answers, results })

  const old = await QuizAttempt.find({ user: req.user._id }).sort({ createdAt: -1 }).skip(MAX_ATTEMPTS)
  if (old.length) await QuizAttempt.deleteMany({ _id: { $in: old.map((a) => a._id) } })

  res.status(201).json(attempt)
}

// GET /api/quiz/attempts — newest first
export async function listAttempts(req, res) {
  res.json(await QuizAttempt.find({ user: req.user._id }).sort({ createdAt: -1 }))
}

// GET /api/quiz/attempts/:id/recommendations — up to 3 of each top-2 track's listed courses,
// skipping modules already completed and those whose prereqs aren't met.
export async function getRecommendations(req, res) {
  const attempt = await QuizAttempt.findOne({ _id: req.params.id, user: req.user._id })
  if (!attempt) throw httpError(404, 'Attempt not found')

  const done = new Set(req.user.completedModules)
  const top = attempt.results.slice(0, 2)
  const recommendations = await Promise.all(
    top.map(async ({ track }) => {
      const trackDoc = await Track.findOne({ trackCode: track }).sort({ majorId: -1 })
      const reqs = trackDoc ? await Requirement.find({ ownerId: trackDoc._id }).sort({ order: 1 }) : []
      const listed = [...new Set(reqs.flatMap((r) => r.modules))] // compulsory course first
      const found = await Module.find({ _id: { $in: listed } }, { description: 0 })
      const modules = listed
        .map((code) => found.find((m) => m._id === code))
        .filter(Boolean)
        .filter((m) => !done.has(m._id) && unmetGroups(m.prerequisites, (c) => done.has(c)).length === 0)
        .slice(0, 3)
      return { track, modules }
    }),
  )
  res.json(recommendations)
}
