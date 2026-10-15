// Shared formats and small schemas used by several models.
import mongoose from 'mongoose';

const { Schema } = mongoose;

// Schema options
export const catalogueOptions = { versionKey: false };                  // seeded, read-only data
export const userOptions = { timestamps: true, versionKey: false };     // adds createdAt / updatedAt

// Formats
export const TERM_KEY = /^\d{4}-\d{2}_T(1|2|3A|3B)$/;      // e.g. 2026-27_T1
export const MODULE_CODE = /^[A-Z]+(-[A-Z]+)?\d{3,4}$/;    // e.g. IS216, IS4001, COR-STAT1202
export const TRACK_CODES = ['BA', 'FT', 'PD', 'SMCT'];
export const COUNTS_TOWARD = ['UNI_CORE', 'MAJOR_CORE', 'MAJOR_ELECTIVES', 'FREE_ELECTIVES'];
export const ROUNDS = ['1', '1A', '1B', '2', '2A'];

// Weights for each track, used by quiz questions
export const trackWeightsSchema = new Schema({
  BA: { type: Number, default: 0 },
  FT: { type: Number, default: 0 },
  PD: { type: Number, default: 0 },
  SMCT: { type: Number, default: 0 },
}, { _id: false });

// One quiz answer, used by QuizAttempt and TrainingResponse
export const answerSchema = new Schema({
  questionId: { type: String, ref: 'QuizQuestion', required: true },
  optionId: String,                         // single-choice questions
  value: { type: Number, min: 1, max: 5 },  // scale questions
}, { _id: false });
