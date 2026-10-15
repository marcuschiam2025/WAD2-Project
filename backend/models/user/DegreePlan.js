// DegreePlan model (degreePlans)
import mongoose from 'mongoose';
import { TERM_KEY, TRACK_CODES, COUNTS_TOWARD, userOptions } from '../shared.js';

const { Schema } = mongoose;

const planItemSchema = new Schema({
  moduleCode: { type: String, ref: 'Module' },  // a real module...
  placeholder: String,                          // ...or a placeholder such as CORE:MANAGING
  countsToward: { type: String, enum: COUNTS_TOWARD },
}, { _id: false });

planItemSchema.pre('validate', function () {
  if (!this.moduleCode === !this.placeholder) {
    throw new Error('A plan item needs exactly one of moduleCode or placeholder');
  }
});

const planTermSchema = new Schema({
  termKey: { type: String, match: TERM_KEY, required: true },
  status: { type: String, enum: ['normal', 'LOA', 'exchange'], default: 'normal' },
  items: [planItemSchema],
}, { _id: false });

const degreePlanSchema = new Schema({
  userId: { type: String, ref: 'User', required: true },
  slot: { type: Number, enum: [1, 2, 3], required: true },
  name: String,
  trackCode: { type: String, enum: TRACK_CODES },
  terms: [planTermSchema],                  // future terms only; past terms come from creditRecords
}, userOptions);

degreePlanSchema.index({ userId: 1, slot: 1 }, { unique: true });

export default mongoose.model('DegreePlan', degreePlanSchema, 'degreePlans');
