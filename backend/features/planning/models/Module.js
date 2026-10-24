import mongoose from 'mongoose'

// Catalogue entry, built from the SMU courses report by scripts/build-catalogue.js. Seeded initially; staff edits are audited.
const moduleSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // course code, e.g. IS460
    archived: { type: Boolean, default: false },
    revision: { type: Number, default: 0 },
    title: { type: String, required: true },
    cu: { type: Number, default: 1 },
    schoolId: { type: String, ref: 'School', default: null },
    department: String, // BOSS department code, e.g. SIS
    description: String,
    categories: [String], // IS, IS_TRACK, IS_RELATED — matched by "anyFromCategory" requirements
    fulfils: [String], // e.g. CORE:MANAGING, GRAD:SUSTAINABILITY — matched by "basket" / "flag" requirements
    prerequisites: [[String]], // AND of OR-groups: [["IS111","CS101"],["IS217"]]
    corequisites: [[String]], // same shape; may be taken in the same term
    mutuallyExclusive: [String],
    prerequisiteRules: [{ _id: false, countFrom: String, n: Number }], // e.g. 2 track courses done first
    requisiteNotes: [String], // free-text requisites (min grade, instructor's permission, …)
    termsOffered: [String], // e.g. ['T1', 'T2']; empty = unknown
    lastOffered: { type: String, default: null }, // latest term it ran in, e.g. AY26/27 T2; null = not in our data
    offeredRecently: { type: Boolean, default: true }, // ran in about the last 2 years; false = probably retired
  },
  { versionKey: false },
)

export default mongoose.model('Module', moduleSchema, 'modules')
