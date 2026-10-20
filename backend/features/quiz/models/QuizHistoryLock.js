import mongoose from 'mongoose'

// Updating one document per student serialises transactional history pruning,
// including concurrent submissions carrying different submission IDs.
const schema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, required: true },
  revision: { type: Number, default: 0 },
})

export default mongoose.model('QuizHistoryLock', schema)
