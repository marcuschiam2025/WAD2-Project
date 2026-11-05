// Major model (majors)
import mongoose from 'mongoose';

const { Schema } = mongoose;

const majorSchema = new Schema(
  {
    _id: { type: String, required: true }, // e.g. BSC-IS_AY2025
    majorCode: { type: String, required: true },
    name: { type: String, required: true },
    degreeCode: { type: String, required: true },
    degreeName: { type: String, required: true },
    schoolId: { type: String, ref: 'School', required: true },
    intakeFrom: { type: Number, required: true },
    intakeTo: { type: Number, default: null }, // null = current curriculum
    intakeVerified: Boolean,
    totalCU: { type: Number, required: true },
    trackRequired: { type: Boolean, default: null },
    trackCU: { type: Number, default: null },
    requirementsAvailable: { type: Boolean, default: false },
    source: String,
    lastChecked: Date,
  },
  { versionKey: false },
); // seeded, read-only data

majorSchema.index({ majorCode: 1, intakeFrom: 1 }, { unique: true });

export default mongoose.model('Major', majorSchema, 'majors');
