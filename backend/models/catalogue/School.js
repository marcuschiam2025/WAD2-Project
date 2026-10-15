// School model (schools)
import mongoose from 'mongoose';
import { catalogueOptions } from '../shared.js';

const { Schema } = mongoose;

const schoolSchema = new Schema({
  _id: { type: String, required: true },    // e.g. SCIS
  name: { type: String, required: true },
  bossCode: String,                         // code BOSS uses, e.g. SIS
}, catalogueOptions);

export default mongoose.model('School', schoolSchema, 'schools');
