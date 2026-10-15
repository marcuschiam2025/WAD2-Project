// Requirement model (requirements)
import mongoose from 'mongoose';
import { catalogueOptions } from '../shared.js';

const { Schema } = mongoose;

const requirementSchema = new Schema({
  _id: { type: String, required: true },    // e.g. BSC-IS_AY2025_TECH_SOL
  level: { type: String, enum: ['core', 'major', 'track'], required: true },
  ownerId: { type: String, required: true },  // a major _id (core, major) or track _id (track)
  countsToward: {
    type: String, required: true,
    enum: ['UNI_CORE', 'MAJOR_CORE', 'MAJOR_ELECTIVES', 'FREE_ELECTIVES', 'NONE'],
  },
  heading: String,
  label: String,
  order: Number,
  cuRequired: { type: Number, required: true, min: 0 },
  rule: { type: String, enum: ['all', 'chooseN', 'basket', 'anyFromCategory', 'flag'], required: true },
  n: Number,                                // chooseN
  modules: [String],                        // all, chooseN
  tag: String,                              // basket, flag, e.g. CORE:MANAGING
  categories: [String],                     // anyFromCategory
  autoFulfilled: Boolean,                   // flag
}, catalogueOptions);

requirementSchema.index({ ownerId: 1, order: 1 });

export default mongoose.model('Requirement', requirementSchema, 'requirements');
