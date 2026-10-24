import mongoose from 'mongoose'

export const REQUIREMENT_RULES = ['all', 'chooseN', 'basket', 'anyFromCategory', 'flag']

// One graduation rule of a major (level core / major) or of one of its tracks (level track).
//   all             — take every course in `modules`
//   chooseN         — take `n` of `modules`
//   basket          — `cuRequired` CU of courses whose `fulfils` includes `tag`
//   anyFromCategory — `cuRequired` CU of courses in any of `categories` (ANY = any course)
//   flag            — non-credit: some course carrying `tag` (or `autoFulfilled`)
const requirementSchema = new mongoose.Schema(
  {
    revision: { type: Number, default: 0 },
    _id: { type: String, required: true }, // e.g. BSC-IS_AY2025_TECH_SOL
    level: { type: String, enum: ['core', 'major', 'track'], required: true },
    ownerId: { type: String, required: true, index: true }, // a major _id, or a track _id for level track
    countsToward: String, // UNI_CORE, MAJOR_CORE, MAJOR_ELECTIVES, FREE_ELECTIVES or NONE
    heading: String,
    label: { type: String, required: true },
    order: Number,
    cuRequired: { type: Number, default: 0 },
    rule: { type: String, enum: REQUIREMENT_RULES, required: true },
    n: Number,
    modules: [String],
    tag: String,
    categories: [String],
    autoFulfilled: Boolean,
  },
  { versionKey: false }, // seeded initially; staff edits are audited
)

export default mongoose.model('Requirement', requirementSchema, 'requirements')
