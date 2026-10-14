import { Router } from 'express'
import QuizQuestion from '../models/QuizQuestion.js'
import QuizAttempt from '../models/QuizAttempt.js'
import Track from '../models/Track.js'
import Module from '../models/Module.js'
import { scoreQuiz } from '../utils/trackScoring.js'
import { httpError } from '../middleware/errorHandler.js'

const router = Router()

// Only the latest attempts are stored; a new attempt overlays the oldest.
const MAX_ATTEMPTS = 2

// GET /api/quiz/questions — weights are server-side only
router.get('/questions', async (req, res) => {
  const questions = await QuizQuestion.find().sort({ order: 1 }).select('-options.weights')
  res.json(questions)
})

// POST /api/quiz/attempts { answers: [optionIndex | null, ...] }
router.post('/attempts', async (req, res) => {
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
})

// GET /api/quiz/attempts — newest first
router.get('/attempts', async (req, res) => {
  res.json(await QuizAttempt.find({ user: req.user._id }).sort({ createdAt: -1 }))
})

// GET /api/quiz/attempts/:id/recommendations — up to 3 modules per top-2 track,
// skipping modules already completed and those whose prereqs aren't met.
router.get('/attempts/:id/recommendations', async (req, res) => {
  const attempt = await QuizAttempt.findOne({ _id: req.params.id, user: req.user._id })
  if (!attempt) throw httpError(404, 'Attempt not found')

  const done = new Set(req.user.completedModules)
  const top = attempt.results.slice(0, 2)
  const recommendations = await Promise.all(
    top.map(async ({ track }) => {
      const trackDoc = await Track.findOne({ code: track }).sort({ intake: -1 })
      const candidates = await Module.find({ code: { $in: trackDoc?.recommended ?? [] } })
      const modules = candidates
        .filter((m) => !done.has(m.code) && m.prereqs.every((p) => done.has(p)))
        .slice(0, 3)
      return { track, modules }
    }),
  )
  res.json(recommendations)
})

export default router
