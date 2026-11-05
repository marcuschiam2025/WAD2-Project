import mongoose from 'mongoose';

// Historical bid result for a module in one term + BOSS round.
const bidHistorySchema = new mongoose.Schema({
  module: { type: String, required: true, index: true },
  term: { type: String, required: true }, // e.g. AY24/25 T1
  round: { type: String, required: true }, // e.g. 1A
  median: { type: Number, required: true },
  min: { type: Number, required: true },
  vacancies: Number, // seats on offer when the round opened
  demand: Number, // seats filled across the round's windows (BOSS doesn't publish bid counts)
});

bidHistorySchema.index({ module: 1, term: 1, round: 1 }, { unique: true });

export default mongoose.model('BidHistory', bidHistorySchema);
