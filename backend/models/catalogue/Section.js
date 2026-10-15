// Section model (sections)
import mongoose from 'mongoose';
import { TERM_KEY, catalogueOptions } from '../shared.js';

const { Schema } = mongoose;

const classSlotSchema = new Schema({
  day: { type: String, enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], required: true },
  start: { type: String, match: /^\d{2}:\d{2}$/, required: true },
  end: { type: String, match: /^\d{2}:\d{2}$/, required: true },
  venue: String,
}, { _id: false });

const sectionSchema = new Schema({
  _id: { type: String, required: true },    // e.g. IS216_2026-27_T2_G1
  moduleCode: { type: String, ref: 'Module', required: true },
  termKey: { type: String, match: TERM_KEY, required: true },
  sectionCode: { type: String, required: true },
  instructor: String,                       // exactly as in BOSS, to match bidResults
  session: String,
  startDate: Date,
  endDate: Date,
  classSlots: [classSlotSchema],
  finalExam: {
    type: new Schema({ date: Date, start: String, end: String }, { _id: false }),
    default: null,
  },
  capacity: Number,
  bidStats: {                               // computed from bidResults, not entered by hand
    type: new Schema({
      basis: { type: String, enum: ['instructor', 'module'] },
      round: String,
      window: Number,
      median: Number,
      sd: Number,
      n: Number,
      fillRate: Number,
      computedAt: Date,
    }, { _id: false }),
    default: null,
  },
}, catalogueOptions);

sectionSchema.index({ moduleCode: 1, termKey: 1, sectionCode: 1 }, { unique: true });

export default mongoose.model('Section', sectionSchema, 'sections');
