import Notification from './model/notification.js'
import { httpError } from '../../middleware/errorHandler.js'
import mongoose from 'mongoose'

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


export function displayName(name) {
  if (!name) return 'Someone'

  const words = name.replace(/[\s_]+$/, '').toLowerCase().split(' ')
  const tidy = []
  for (const word of words) {
    if (word) tidy.push(word[0].toUpperCase() + word.slice(1))
  }
  return tidy.join(' ')
}


// ---------------------------------------------------------------------------
// Route handlers (requireAuth has already set req.user)
// ---------------------------------------------------------------------------

// GET /api/notifications?before=<id>: 20 at a time, with the total unread count across every page.
export async function listMine(req, res) {
  const { before } = req.query ?? {}
  const filter = { user: req.user._id }
  if (before !== undefined) {
    if (typeof before !== 'string' || !/^[a-f\d]{24}$/i.test(before)) throw httpError(400, 'Invalid notification cursor')
    const cursor = await Notification.findOne({ user: req.user._id, _id: new mongoose.Types.ObjectId(before) }).select('createdAt').lean()
    if (!cursor) throw httpError(404, 'Notification cursor not found')
    filter.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }]
  }
  const [rows, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).limit(21),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ])
  const notifications = rows.slice(0, 20)
  res.json({ notifications, next: rows.length > 20 ? String(notifications.at(-1)._id) : null, unreadCount })
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
