// QuizQuestion model (quizQuestions)
import mongoose from 'mongoose';
import { trackWeightsSchema, catalogueOptions } from '../shared.js';

const { Schema } = mongoose;

const quizQuestionSchema = new Schema({
  _id: { type: String, match: /^Q\d{2}$/, required: true },  // Q01 ... Q20
  order: { type: Number, min: 1, max: 20, required: true, unique: true },
  category: { type: String, enum: ['interests', 'strengths', 'workingStyle', 'careerGoals'], required: true },
  text: { type: String, required: true },
  type: { type: String, enum: ['single', 'scale'], required: true },
  options: [new Schema({                    // single-choice questions
    optionId: { type: String, required: true },
    label: { type: String, required: true },
    trackWeights: { type: trackWeightsSchema, default: () => ({}) },
  }, { _id: false })],
  trackWeights: { type: trackWeightsSchema, default: undefined },  // scale questions
}, catalogueOptions);

export default mongoose.model('QuizQuestion', quizQuestionSchema, 'quizQuestions');
