import Notification from './model/notification.js'
import { httpError } from '../../middleware/errorHandler.js'

// ---------------------------------------------------------------------------
// Helper for OTHER features (not a route): creates notifications
// ---------------------------------------------------------------------------

// Sends the same notification to one or more users.
export async function notify(userIds, type, message, link) {
  const docs = []
  for (const userId of userIds) {
    docs.push({ user: userId, type, message, link })
  }
  if (docs.length > 0) {
    await Notification.insertMany(docs)
  }
}

// ---------------------------------------------------------------------------
// Route handlers (requireAuth has already set req.user)
// ---------------------------------------------------------------------------

// GET /api/notifications: my 20 newest
export async function listMine(req, res) {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20)
  res.json(notifications)
}

// GET /api/notifications/unread-count: the number on the bell icon? see whether actually want to implement
export async function unreadCount(req, res) {
  const count = await Notification.countDocuments({ user: req.user._id, read: false })
  res.json({ count })
}

// PATCH /api/notifications/:id/read: mark one of MY notifications as read
export async function markRead(req, res) {
  const result = await Notification.updateOne(
    { _id: req.params.id, user: req.user._id }, // must be mine
    { read: true },
  )
  if (result.matchedCount === 0) {
    throw httpError(404, 'Notification not found')
  }
  res.status(204).end()
}

// PATCH /api/notifications/read-all: mark all of mine as read
export async function markAllRead(req, res) {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true })
  res.status(204).end()
}