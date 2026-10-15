// QuizAttempt model (quizAttempts)
import mongoose from 'mongoose';
import { TRACK_CODES, answerSchema, userOptions } from '../shared.js';

const { Schema } = mongoose;

const quizAttemptSchema = new Schema({
  userId: { type: String, ref: 'User', required: true },
  attemptNo: { type: Number, enum: [1, 2], required: true },
  status: { type: String, enum: ['inProgress', 'submitted'], default: 'inProgress' },
  answers: [answerSchema],
  trackScores: [new Schema({
    trackCode: { type: String, enum: TRACK_CODES },
    score: Number,
    percentile: Number,
  }, { _id: false })],
  topTracks: [String],
  recommendedModules: [new Schema({
    trackCode: { type: String, enum: TRACK_CODES },
    moduleCodes: [String],
  }, { _id: false })],
  submittedAt: Date,
}, userOptions);

quizAttemptSchema.index({ userId: 1, attemptNo: 1 }, { unique: true });

export default mongoose.model('QuizAttempt', quizAttemptSchema, 'quizAttempts');
