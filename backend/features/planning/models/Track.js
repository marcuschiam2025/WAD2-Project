import mongoose from 'mongoose';

// A track within a major's curriculum. Its rules live in the requirements collection (ownerId = this _id).
const trackSchema = new mongoose.Schema(
  {
    revision: { type: Number, default: 0 },
    _id: { type: String, required: true }, // e.g. BSC-IS_AY2025_BA
    majorId: { type: String, ref: 'Major', required: true },
    trackCode: { type: String, required: true }, // e.g. BA
    name: { type: String, required: true },
    description: String,
    source: String,
    lastChecked: Date,
  },
  { versionKey: false }, // seeded initially; staff edits are audited
);

export default mongoose.model('Track', trackSchema, 'tracks');
