import mongoose from 'mongoose'

export const NOTIFICATION_TYPES = [ //can expand the list if required, consider reminders to vote
  'party_joined',          // someone joined your party (sent to the owner)
  'party_banned',          // you were removed from a party
  'party_section_changed', // change in target section
]

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // user
    type: { type: String, enum: NOTIFICATION_TYPES, required: true }, //from NOTIICATION_TYPES
    message: { type: String, required: true, maxlength: 300 },  // e.g. "Noah joined IS216 Squad"
    link: String,                                                // redirect to, e.g. "/rooms/6adc..."
    read: { type: Boolean, default: false },                    // keep track of whether it has been read already
  },
  { timestamps: true }, // adds createdAt and updatedAt
)

// Index (kept by MongoDB): a sorted list of each user's notifications, newest first,
// pointing to the full documents. Makes "my newest notifications" and "unread count" fast.
notificationSchema.index({ user: 1, createdAt: -1 })

// MongoDB deletes each notification automatically 60 days after it's created
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 })

const Notification = mongoose.model('Notification', notificationSchema)

export default Notification