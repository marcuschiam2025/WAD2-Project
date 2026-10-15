// Comment model (comments). TEAM TO CONFIRM: keep or cut this feature.
import mongoose from 'mongoose';
import { TERM_KEY, userOptions } from '../shared.js';

const { Schema } = mongoose;

const commentSchema = new Schema({
  partyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true },
  userId: { type: String, ref: 'User', required: true },
  moduleCode: { type: String, ref: 'Module', required: true },
  sectionId: { type: String, ref: 'Section' },
  termKey: { type: String, match: TERM_KEY },
  text: { type: String, required: true, maxlength: 500, trim: true },
  editedAt: Date,
}, userOptions);

commentSchema.index({ partyId: 1, createdAt: 1 });
commentSchema.index({ partyId: 1, moduleCode: 1 });

export default mongoose.model('Comment', commentSchema, 'comments');
