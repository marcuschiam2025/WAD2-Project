import mongoose from 'mongoose'

export const MAX_ROOM_SIZE = 8

const { ObjectId } = mongoose.Schema.Types

// Collaborative plan room. updatedAt doubles as the cursor for the polling endpoint.
const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: String,
    module: { type: String, required: true }, // module the room is bidding for
    inviteCode: { type: String, required: true, unique: true, uppercase: true },
    owner: { type: ObjectId, ref: 'User', required: true },
    maxMembers: { type: Number, min: 2, max: MAX_ROOM_SIZE, default: 6 },
    members: [{ type: ObjectId, ref: 'User' }],
    banned: [{ type: ObjectId, ref: 'User' }],
    votes: [{ _id: false, user: { type: ObjectId, ref: 'User' }, sectionIds: [String] }],
    finalisedSection: String,
    importedPlans: [{ _id: false, user: { type: ObjectId, ref: 'User' }, plan: { type: ObjectId, ref: 'Plan' } }],
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

export default mongoose.model('Room', roomSchema)
