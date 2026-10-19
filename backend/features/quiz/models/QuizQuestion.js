import mongoose from 'mongoose'

const optionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    weights: { type: Map, of: Number, default: {} }, // track code -> weight
  },
  { _id: false },
)

// Track Finder question with per-answer track weights.
const quizQuestionSchema = new mongoose.Schema({
  order: { type: Number, required: true, unique: true },
  section: { type: String, enum: ['interests', 'strengths', 'working-style', 'career-goals'] },
  type: { type: String, enum: ['single', 'scale'], default: 'single' },
  prompt: { type: String, required: true },
  options: { type: [optionSchema], validate: (v) => v.length >= 2 },
})

export default mongoose.model('QuizQuestion', quizQuestionSchema)
