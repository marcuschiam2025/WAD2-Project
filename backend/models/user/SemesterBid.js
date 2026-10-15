// SemesterBid model (semesterBids)
import mongoose from 'mongoose';
import { TERM_KEY, ROUNDS, userOptions } from '../shared.js';

const { Schema } = mongoose;

const bidSchema = new Schema({
  sectionId: { type: String, ref: 'Section', required: true },
  moduleCode: { type: String, ref: 'Module', required: true },
  sectionCode: String,
  round: { type: String, enum: ROUNDS, default: '1' },
  window: { type: Number, default: 1 },
  amount: { type: Number, required: true, min: 10 },
  outcome: { type: String, enum: ['pending', 'successful', 'unsuccessful'], default: 'pending' },
  predictedClearingBid: Number,
  simulatedAt: Date,
}, { _id: false });

const semesterBidSchema = new Schema({
  userId: { type: String, ref: 'User', required: true },
  termKey: { type: String, match: TERM_KEY, required: true },
  planId: { type: Schema.Types.ObjectId, ref: 'DegreePlan' },
  bids: [bidSchema],
  calendarExportedAt: Date,
}, userOptions);

semesterBidSchema.index({ userId: 1, termKey: 1 }, { unique: true });
semesterBidSchema.index({ termKey: 1, 'bids.sectionId': 1 });

export default mongoose.model('SemesterBid', semesterBidSchema, 'semesterBids');
