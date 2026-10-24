import mongoose from 'mongoose'

// Student profile captured at sign-in and in the onboarding setup step.
const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true }, // links this document to the Firebase account
    email: { type: String, required: true, lowercase: true, trim: true }, // from the Firebase token, always @smu.edu.sg
    name: { type: String, trim: true }, // from the Firebase token, editable by the student
    school: { type: String, default: 'SCIS' },
    major: { type: String, default: 'Information Systems' },
    currentSem: { type: String, match: /^Y[1-5]S[12]$/ },
    takenBySem: { type: Map, of: [String], default: {} },
    exempted: [String],
    freeExemptions: { type: Number, min: 0, max: 6, default: 0 },
    markedDone: [String],
    balance: { type: Number, min: 0, default: 210 },
    onboarded: { type: Boolean, default: false },
    intakeYear: Number, // e.g. 2025, decides which track requirements apply
    yearOfStudy: { type: Number, min: 1, max: 5 },
    tracks: [String], // track codes, e.g. ['BA', 'SMT']; empty = undecided
    completedModules: [String], // module codes, entered manually
    basket: [String], // modules saved from match results for the What-If Planner
    // whether the student allowed calendar export to each provider
    consents: {
      gmail: { type: Boolean, default: false },
      outlook: { type: Boolean, default: false },
    },
    // 'admin' is set by hand in MongoDB; checked by requireAdmin in middleware/auth.js.
    // Not in EDITABLE (users.controller.js), so students cannot change it themselves.
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
  },
  { timestamps: true }, // adds createdAt and updatedAt
)

// Finds the user for a verified Firebase login, or creates them on their first login.
// Usage: const user = await User.findOrCreate(firebaseUser)
userSchema.statics.findOrCreate = async function (firebaseUser) {
  let user = await this.findOne({ firebaseUid: firebaseUser.uid })
  if (!user) {
    user = await this.create({
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email,
      name: firebaseUser.name,
      // role is not set here, so it uses the default above: 'student'
    })
  }
  return user
}

export default mongoose.model('User', userSchema)
