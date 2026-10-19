import mongoose from 'mongoose'

// Student profile captured at sign-in and in the onboarding setup step.
const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    school: { type: String, default: 'SCIS' },
    major: { type: String, default: 'Information Systems' },
    intakeYear: Number,
    yearOfStudy: { type: Number, min: 1, max: 5 },
    tracks: [String], // track codes, e.g. ['BA', 'SMT']; empty = undecided
    completedModules: [String], // module codes, entered manually
    basket: [String], // modules saved from match results for the What-If Planner
    consents: {
      gmail: { type: Boolean, default: false },
      outlook: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
)

export default mongoose.model('User', userSchema)
