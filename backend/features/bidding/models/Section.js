import mongoose from 'mongoose'

// One BOSS class section in a term. day: 0 = Monday … 4 = Friday; slot: 0–3 session index.
const sectionSchema = new mongoose.Schema({
  sectionId: { type: String, required: true, unique: true }, // e.g. IS212-G3
  module: { type: String, required: true, index: true },
  section: { type: String, required: true }, // e.g. G3
  term: { type: String, required: true }, // e.g. AY24/25 T2
  day: { type: Number, min: 0, max: 4, required: true },
  slot: { type: Number, min: 0, max: 3, required: true },
  prof: String,
  venue: String,
  exam: String,
  capacity: Number,
})

export const SLOTS = [
  { start: '08:15', end: '11:30' },
  { start: '12:00', end: '15:15' },
  { start: '15:30', end: '18:45' },
  { start: '19:00', end: '22:15' },
]

export default mongoose.model('Section', sectionSchema)
