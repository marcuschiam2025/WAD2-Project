import mongoose from 'mongoose';

const responseSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    optionId: { type: String, default: null }, // null is an explicit Skip
  },
  { _id: false },
);

const resultSchema = new mongoose.Schema(
  {
    track: String,
    pct: Number, // legacy only; never use as a fallback for a missing v2 index
    rank: { type: Number, min: 1, validate: Number.isInteger },
    alignmentIndex: { type: Number, min: 0, max: 100 }, // the score students see; ratings and scenarios combined from v2.1
    ratingAlignmentIndex: { type: Number, min: 0, max: 100 },
    scenarioPreferenceIndex: { type: Number, min: 0, max: 100 },
  },
  { _id: false },
);

const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    answers: [Number], // chosen option index per question, null when skipped
    results: [resultSchema], // sorted best match first; shared ranks allowed
    // Optional v2 fields preserve reading/writing through the existing controller.
    // Historical attempts without rubricVersion remain explicitly legacy.
    rubricVersion: String,
    submissionId: String,
    responses: { type: [responseSchema], default: undefined },
    rankingBasis: { type: String, enum: ['blended', 'rating', 'scenario-provisional'] },
    themeCoverage: {
      type: Map,
      of: { type: Number, min: 0, max: 2, validate: Number.isInteger },
      default: undefined,
    },
    // Server-generated immutable-at-submission context for historical rendering:
    // question/answer labels, explanations and the exact rubric used. Never copy
    // this field from a client's request body.
    rubricSnapshot: { type: mongoose.Schema.Types.Mixed, select: false },
    resultSnapshot: mongoose.Schema.Types.Mixed,
    // Gemini's explanation of the leading track(s), generated on first view and reused after that
    aiExplanation: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);

export default mongoose.model('QuizAttempt', quizAttemptSchema);
