import mongoose from 'mongoose'

// IS track and its requirements. Requirements differ by intake, so (code, intake) is unique.
const trackSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true }, // e.g. BA
  name: { type: String, required: true },
  short: String,
  intake: { type: Number, required: true },
  blurb: String,
  requiredCu: { type: Number, default: 4 },
  compulsory: [String], // module codes
  electives: [String],
  recommended: [String], // starter basket shown on match results
})

trackSchema.index({ code: 1, intake: 1 }, { unique: true })

export default mongoose.model('Track', trackSchema)
