import mongoose from 'mongoose'

export const MODULE_CATEGORIES = ['uni-core', 'major-core', 'track', 'depth', 'free']

// Catalogue entry, seeded from the cleaned BOSS module list.
const moduleSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true },
  cu: { type: Number, default: 1 },
  description: String,
  category: { type: String, enum: MODULE_CATEGORIES, required: true },
  tracks: [String], // track codes this module counts towards
  prereqs: [String],
  coreqs: [String],
  topicTags: [String], // matched against quiz answers by the recommender
  termsOffered: { type: [Number], default: [1, 2] },
  compulsory: { type: Boolean, default: false },
})

export default mongoose.model('Module', moduleSchema)
