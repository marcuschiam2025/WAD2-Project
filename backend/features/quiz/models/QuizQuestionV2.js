import mongoose from 'mongoose'

const optionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false },
)

// Separate collection: the legacy QuizQuestion model has a global unique order
// index. Published versions must be able to reuse question orders and IDs.
const quizQuestionV2Schema = new mongoose.Schema({
  rubricVersion: { type: String, required: true },
  id: { type: String, required: true },
  order: { type: Number, required: true, min: 1, validate: Number.isInteger },
  section: {
    type: String,
    required: true,
    enum: ['interests', 'strengths', 'working-style', 'career-goals'],
  },
  type: { type: String, required: true, enum: ['rating', 'scenario'] },
  prompt: { type: String, required: true },
  options: {
    type: [optionSchema],
    validate: {
      validator(options) {
        const expected = this.type === 'rating' ? ['1', '2', '3', '4', '5'] : ['a', 'b', 'c', 'd', 'e']
        return options.length === 5 && expected.every((id) => options.some((option) => option.id === id))
      },
      message: 'Options must contain the five distinct IDs for the question type',
    },
  },
})

quizQuestionV2Schema.index({ rubricVersion: 1, id: 1 }, { unique: true })
quizQuestionV2Schema.index({ rubricVersion: 1, order: 1 }, { unique: true })

export default mongoose.model('QuizQuestionV2', quizQuestionV2Schema)
