import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    term: { type: String, required: true },
    round: { type: String, required: true },
    closesAt: { type: Date, required: true },
    revision: { type: Number, required: true },
  },
  { versionKey: false },
);
export default mongoose.model('BiddingSettings', schema, 'bidding_settings');
