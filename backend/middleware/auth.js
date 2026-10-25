import { auth } from '../config/firebase.js'
import findOrCreateUser from '../features/auth/models/User.js'

const ALLOWED_DOMAIN = '@smu.edu.sg'

// Runs before every protected route.
// 1. Reads the Firebase token from the "Authorization: Bearer <token>" header
// 2. Asks Firebase if the token is real
// 3. Loads the user from MongoDB (creates them on their first login)
// 4. Puts the user on req.user so controllers can use it
export async function requireAuth(req, res, next) {
  // 1. Get the token
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not logged in' })
  }
  const token = header.split(' ')[1]

  // 2. Check the token with Firebase
  let firebaseUser
  try {
    firebaseUser = await auth.verifyIdToken(token)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  if (!firebaseUser.email || !firebaseUser.email.endsWith(ALLOWED_DOMAIN)) {
    return res.status(403).json({ error: 'Only @smu.edu.sg accounts are allowed' })
  }

  // 3. Get the user from MongoDB (the database code lives in models/User.js)
  req.user = await findOrCreate(firebaseUser)

  // 4. Hand over to the next function
  next()
}

// Runs after requireAuth, on admin-only routes.
// The role comes from the user's document in MongoDB.
export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' })
  }
  next()
}
