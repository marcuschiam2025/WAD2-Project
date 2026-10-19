import mongoose from 'mongoose'

export const MAX_PLANS = 3

const semesterSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // e.g. Y2S1
    label: String, // e.g. "Y2 · S1"
    exchange: { type: Boolean, default: false },
    loa: { type: Boolean, default: false }, // leave of absence
    modules: [String], // module codes; exchange mappings stored as "CS412 → IS460"
  },
  { _id: false },
)

// A What-If plan: up to MAX_PLANS per student.
const planSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    tracks: { type: [String], validate: (v) => v.length <= 2 },
    currentSem: String,
    semesters: [semesterSchema],
  },
  { timestamps: true },
)

export default mongoose.model('Plan', planSchema)
