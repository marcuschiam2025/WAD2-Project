import mongoose from 'mongoose';

// A second major offered by SCIS, with its requirements stored inside it (seeded, read-only data).
// Each requirement is `all` or `chooseN` over `modules`, the same rules a first major's requirements use.
const secondMajorSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // e.g. T4BS
    name: { type: String, required: true },
    eligibleMajors: [String], // first majors that can declare it, by majorCode
    curriculumFrom: Number, // the oldest first-major curriculum these requirements apply to
    source: String,
    requirements: [mongoose.Schema.Types.Mixed],
    tracks: [mongoose.Schema.Types.Mixed], // [{ trackCode, name, requirements }]
  },
  { versionKey: false },
);

export default mongoose.model('SecondMajor', secondMajorSchema, 'secondmajors');
