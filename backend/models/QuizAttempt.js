import mongoose from 'mongoose'

// Only the latest attempts are kept (see MAX_ATTEMPTS in routes/quiz.js).
const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    answers: [Number], // chosen option index per question, null when skipped
    results: [{ _id: false, track: String, pct: Number }], // sorted best match first
  },
  { timestamps: true },
)

export default mongoose.model('QuizAttempt', quizAttemptSchema)
