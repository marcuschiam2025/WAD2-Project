// Party model (parties)
import mongoose from 'mongoose';
import { TERM_KEY, userOptions } from '../shared.js';

const { Schema } = mongoose;

const MAX_PARTY_SIZE = 8;  // TEAM TO CONFIRM: 8 including the host, or 7 + host?

const partySchema = new Schema({
  name: { type: String, required: true },
  inviteCode: { type: String, required: true, unique: true, uppercase: true },
  hostId: { type: String, ref: 'User', required: true },
  members: {
    type: [new Schema({
      userId: { type: String, ref: 'User', required: true },
      planId: { type: Schema.Types.ObjectId, ref: 'DegreePlan' },  // the plan this member shares here
      joinedAt: { type: Date, default: Date.now },
    }, { _id: false })],
    validate: [m => m.length <= MAX_PARTY_SIZE, `A party can have at most ${MAX_PARTY_SIZE} members`],
  },
  biddingTerm: { type: String, match: TERM_KEY },
  // TEAM TO CONFIRM: the draft's "module" field (one party per module?) is left out until decided.
}, userOptions);  // updatedAt doubles as the polling timestamp

partySchema.index({ 'members.userId': 1 });

export default mongoose.model('Party', partySchema, 'parties');
