// features/bidding/models/BiddingWindow.js
import mongoose from 'mongoose'

const ROUNDS = ['1', '1A', '1B', '2', '2A']

// One BOSS bidding window, e.g. Round 1A Window 2 of 2026-27 Term 2.
// Times are stored in UTC; Singapore time is UTC+8.
const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },                 // e.g. "2026-27_T2_1A_W2"
    term: { type: String, required: true },                // e.g. "2026-27_T2"
    round: { type: String, enum: ROUNDS, required: true },
    window: { type: Number, min: 1, required: true },
    opensAt: { type: Date, required: true },
    closesAt: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return value > this.opensAt
        },
        message: 'closesAt must be after opensAt',
      },
    },
    resultsAt: Date,                                       // when results are released
    note: String,                                          // e.g. "times inferred, check BOSS"
  },
  { versionKey: false },
)

// Each round and window appears once per term
schema.index({ term: 1, round: 1, window: 1 }, { unique: true })
// Makes the date lookups below fast
schema.index({ opensAt: 1, closesAt: 1 })

// The window open right now, or null between windows
schema.statics.findCurrent = function (now = new Date()) {
  return this.findOne({ opensAt: { $lte: now }, closesAt: { $gt: now } })
}

// The next window to open, or null when none are left
schema.statics.findNext = function (now = new Date()) {
  return this.findOne({ opensAt: { $gt: now } }).sort({ opensAt: 1 })
}

export default mongoose.model('BiddingWindow', schema, 'bidding_windows')