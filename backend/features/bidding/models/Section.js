import mongoose from 'mongoose'
import Module from '../../planning/models/Module.js'

// 24h time, e.g. 08:15
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

// One weekly class meeting. day: 0 = Monday … 6 = Sunday; times are 24h "HH:MM".
const meetingSchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    start: { type: String, required: true, match: [TIME, 'start must be a 24h time like 08:15'] },
    end: {
      type: String,
      required: true,
      match: [TIME, 'end must be a 24h time like 11:30'],
      validate: {
        // "HH:MM" strings compare in time order
        validator: function (end) {
          return end > this.start
        },
        message: 'end must be after start',
      },
    },
    venue: String,
  },
  { _id: false },
)

// One BOSS class section in a term, built by scripts/build-sections.js from the BOSS timetable export.
const sectionSchema = new mongoose.Schema({
  sectionId: { type: String, required: true }, // e.g. IS212-G3
  module: { type: String, required: true, index: true }, // Module _id, e.g. IS212
  section: { type: String, required: true }, // e.g. G3
  term: { type: String, required: true }, // e.g. AY26/27 T2
  session: String, // "1" = the full term, "1A" = the first half only
  title: String, // BOSS's short title, e.g. "Corp Reporting & Fin Analysis"
  topic: String, // e.g. SMU-X, or the country of a study mission
  classNumber: String,
  instructors: [String],
  // Usually one a week; language courses meet twice. Empty for work-study electives and SMU-X
  // projects, which have no fixed class time and never clash.
  meetings: [meetingSchema],
  startDate: String, // YYYY-MM-DD
  endDate: String,
  exam: String, // free-text exam note on older rows; finalExam is the structured version
  finalExam: { date: Date, start: String, end: String, venue: String }, // null = no final exam; missing = not announced
  examSource: { type: String, enum: ['boss', 'admin'] }, // who set finalExam: pnpm import-exams or staff
  capacity: Number,
  archived: { type: Boolean, default: false }, // staff archive: hidden from new choices, kept for saved carts
  revision: { type: Number, default: 0 }, // bumped on every admin edit, so two admins can't overwrite each other
})

// MongoDB has no foreign keys, so check the module exists before a section is saved.
// (Runs on create() and save(); the seed script checks its data itself.)
sectionSchema.pre('validate', async function () {
  if (!this.isModified('module')) return
  const exists = await Module.exists({ _id: this.module })
  if (!exists) {
    this.invalidate('module', `Module ${this.module} does not exist`)
  }
})

// A section id repeats every term, so it is unique per term
sectionSchema.index({ term: 1, sectionId: 1 }, { unique: true })

// SMU's standard 3h15 class blocks, used by the timetable grid
export const SLOTS = [
  { start: '08:15', end: '11:30' },
  { start: '12:00', end: '15:15' },
  { start: '15:30', end: '18:45' },
  { start: '19:00', end: '22:15' },
]

export default mongoose.model('Section', sectionSchema)
