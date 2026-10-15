// Module model (modules)
import mongoose from 'mongoose';
import { MODULE_CODE, catalogueOptions } from '../shared.js';

const { Schema } = mongoose;

const moduleSchema = new Schema({
  _id: { type: String, required: true, match: MODULE_CODE },  // module code as used in BOSS
  title: { type: String, required: true },
  cu: { type: Number, default: 1 },
  schoolId: { type: String, ref: 'School', default: null },   // null for offices such as CEC/OCC
  department: String,                       // raw BOSS department code
  categories: [String],                     // IS, IS_TRACK, IS_RELATED
  fulfils: [String],                        // CORE:... baskets and GRAD:... flags
  prerequisites: { type: [[String]], default: [] },  // AND of OR-groups
  corequisites: { type: [[String]], default: [] },
  prerequisiteRules: [new Schema({ countFrom: String, n: Number }, { _id: false })],
  mutuallyExclusive: [String],
  termsOffered: [String],
}, catalogueOptions);

export default mongoose.model('Module', moduleSchema, 'modules');
