import mongoose from 'mongoose'

// The kinds of notification the app can send. Add a type here before using it.
export const NOTIFICATION_TYPES = [
  'party_joined',          // someone joined your party (sent to the owner)
  'party_banned',          // you were removed from a party
  'party_section_changed', // a party member changed the section they're going for
]

// One notification for one user
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who it's for
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    message: { type: String, required: true, maxlength: 300 },  // e.g. "Noah joined IS216 Squad"
    link: String,                                                // where clicking it goes, e.g. "/rooms/6adc..."
    read: { type: Boolean, default: false },
  },
  { timestamps: true }, // adds createdAt and updatedAt
)

// Makes "my newest notifications" and "how many are unread?" fast
notificationSchema.index({ user: 1, createdAt: -1 })

// MongoDB deletes each notification automatically 60 days after it's created
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 })

const Notification = mongoose.model('Notification', notificationSchema)

export default Notification