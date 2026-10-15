// Track model (tracks)
import mongoose from 'mongoose';
import { TRACK_CODES, catalogueOptions } from '../shared.js';

const { Schema } = mongoose;

const trackSchema = new Schema({
  _id: { type: String, required: true },    // e.g. BSC-IS_AY2025_PD
  majorId: { type: String, ref: 'Major', required: true },
  trackCode: { type: String, enum: TRACK_CODES, required: true },
  name: { type: String, required: true },
  description: String,
  facultyAdvisor: String,
  source: String,
  lastChecked: Date,
}, catalogueOptions);

trackSchema.index({ majorId: 1, trackCode: 1 }, { unique: true });

export default mongoose.model('Track', trackSchema, 'tracks');
