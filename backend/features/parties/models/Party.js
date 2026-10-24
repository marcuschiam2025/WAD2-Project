import mongoose from 'mongoose'

export const MAX_PARTY_SIZE = 8

const { ObjectId } = mongoose.Schema.Types

// A party of students planning and bidding for one module together.
// updatedAt doubles as the cursor for the polling endpoint.
const partySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: String,
    revision: { type: Number, default: 0 },
    term: String, // pinned on the first saved ballot
    module: { type: String, required: true }, // module the party is bidding for
    inviteCode: { type: String, required: true, unique: true, uppercase: true },
    owner: { type: ObjectId, ref: 'User', required: true },
    maxMembers: { type: Number, min: 2, max: MAX_PARTY_SIZE, default: 6 },
    members: [{ type: ObjectId, ref: 'User' }],
    banned: [{ type: ObjectId, ref: 'User' }],
    votes: [{ _id: false, user: { type: ObjectId, ref: 'User' }, sectionIds: [String] }],
    finalisedSection: String,
    // Historical field only: no import route and never exposed on room reads.
    importedPlans: { type: [{ _id: false, user: { type: ObjectId, ref: 'User' }, plan: { type: ObjectId, ref: 'Plan' } }], select: false },
    comments: [
      {
        user: { type: ObjectId, ref: 'User' },
        module: String,
        text: { type: String, required: true, maxlength: 500 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
)

export default mongoose.model('Party', partySchema)
