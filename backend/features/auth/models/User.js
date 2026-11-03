import mongoose from 'mongoose'

// profile is captured at sign-in/sign-up
const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true }, // links this document to the Firebase account
    email: { type: String, required: true, lowercase: true, trim: true }, // from Firebase
    name: { type: String, trim: true }, // from the Firebase token, eg "NOAH GAN _"
    school: { type: String, default: 'SCIS' }, //for now just default to SCIS + info sys. Have to expand if wanna add more schools
    major: { type: String, default: 'Information Systems' },
    currentSem: { type: String, match: /^Y[1-5]S[12]$/ }, 
    takenBySem: { type: Map, of: [String], default: {} },
    exempted: [String],
    freeExemptions: { type: Number, min: 0, max: 6, default: 0 },
    balance: { type: Number, min: 0, default: 210 }, //default number is arbitrary
    onboarded: { type: Boolean, default: false },
    intakeYear: Number, // decides which track requirements apply
    yearOfStudy: { type: Number, min: 1, max: 5 },
    tracks: [String], // track codes, e.g. ['BA', 'SMT']. empty = undecided
    completedModules: [String], // module codes
    markedDone: [String], //['internship', 'community', 'exposure']
    // 'admin' is assigned by the controlled bootstrap script; checked by requireAdmin in middleware/auth.js.
    // Not in EDITABLE (users.controller.js), so students cannot change it themselves.
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    
    
    //=============================
    //to remove:
    
    //basket: [String], 
    // consents: {
    //   gmail: { type: Boolean, default: false },
    //   outlook: { type: Boolean, default: false },
    // }, 
    //================================// moved to bidCart collection/not in use


   
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
