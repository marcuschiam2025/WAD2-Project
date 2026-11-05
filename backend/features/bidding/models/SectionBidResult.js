import mongoose from 'mongoose';

// One BOSS bid result: a section in one term, round and bidding window, built by
// scripts/build-bid-history.js. Only windows that cleared bids (median > 0) are kept.
// The reference bid matches an upcoming section on module + instructorKey + slotKey + round
// (utils/bidMatch.js), falling back to fewer fields when there is no match.
const sectionBidResultSchema = new mongoose.Schema({
  term: { type: String, required: true }, // e.g. AY26/27 T1
  round: { type: String, required: true }, // e.g. 1A
  window: { type: Number, required: true }, // 1, 2, 3
  module: { type: String, required: true }, // e.g. IS212
  section: { type: String, required: true }, // e.g. G3: a label only, the prof and time can change each term
  instructors: [String], // display names, e.g. ['KELLY NGO']
  instructorKey: String, // sorted names joined with "; ", for matching the exact set of instructors
  // Weekly class times, e.g. "0-15:30" (Monday 3:30pm) or "0-08:15|3-08:15". "" = no fixed class time.
  // null = unknown: the term has no class schedule to look it up in (AY25/26 T1).
  slotKey: { type: String, default: null },
  vacancyBefore: Number, // seats on offer when the window opened
  vacancyAfter: Number,
  enrolled: Number,
  median: { type: Number, required: true },
  min: { type: Number, required: true },
});

sectionBidResultSchema.index({ module: 1, round: 1, term: -1 });
sectionBidResultSchema.index({ term: 1, module: 1, section: 1, round: 1, window: 1 }, { unique: true });

export default mongoose.model('SectionBidResult', sectionBidResultSchema);
