import { firebaseAuth } from '../config/firebase.js'
import User from '../models/User.js'

const ALLOWED_DOMAIN = '@smu.edu.sg'

async function identify(req) {
  if (process.env.AUTH_DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    const uid = req.get('x-dev-uid') ?? 'dev-user'
    return { uid, email: `${uid}@smu.edu.sg`, name: 'Dev User' }
  }
  const token = req.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  try {
    return await firebaseAuth().verifyIdToken(token)
  } catch {
    return null
  }
}

// Verifies the Firebase ID token in "Authorization: Bearer <token>" and attaches req.user.
// The first request from a new student creates their User document.
export async function requireAuth(req, res, next) {
  const identity = await identify(req)
  if (!identity) return res.status(401).json({ error: 'Missing, invalid or expired token' })

  const { uid, email, name } = identity
  if (!email?.endsWith(ALLOWED_DOMAIN)) {
    return res.status(403).json({ error: 'Only @smu.edu.sg accounts can use BidMaxxer' })
  }

  req.user = await User.findOneAndUpdate(
    { firebaseUid: uid },
    { $setOnInsert: { firebaseUid: uid, email, name } },
    { upsert: true, new: true },
  )
  next()
}
