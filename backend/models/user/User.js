// User model (users)
import mongoose from 'mongoose';
import { TERM_KEY, TRACK_CODES, COUNTS_TOWARD, userOptions } from '../shared.js';

const { Schema } = mongoose;

const creditRecordSchema = new Schema({
  type: { type: String, enum: ['completed', 'exempted'], required: true },
  moduleCode: { type: String, ref: 'Module', default: null },  // null for e.g. an exempted free elective
  termKey: { type: String, match: TERM_KEY, default: null },
  countsToward: { type: String, enum: COUNTS_TOWARD, required: true },
  cu: { type: Number, required: true, min: 0 },
  note: String,
}, { _id: false });

const userSchema = new Schema({
  _id: { type: String, required: true },    // Firebase UID
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: String,
  photoUrl: String,
  intakeYear: Number,
  majorId: { type: String, ref: 'Major' },
  trackCode: { type: String, enum: [...TRACK_CODES, null], default: null },  // null = not declared yet
  creditRecords: [creditRecordSchema],
}, userOptions);

export default mongoose.model('User', userSchema, 'users');
