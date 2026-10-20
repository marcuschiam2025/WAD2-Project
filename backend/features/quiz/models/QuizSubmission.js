import mongoose from 'mongoose'

// Retain only a request fingerprint after an attempt leaves the two-result
// history. A late network retry must not recreate an evicted attempt.
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  submissionId: { type: String, required: true },
  fingerprint: { type: String, required: true },
  attemptId: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { timestamps: true })

schema.index({ user: 1, submissionId: 1 }, { unique: true })
export default mongoose.model('QuizSubmission', schema)
