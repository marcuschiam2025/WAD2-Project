import { auth, db } from '../config/firebase.js'

const ALLOWED_DOMAIN = '@smu.edu.sg'

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null
  if (!token) return res.status(401).json({ error: 'Not logged in' })

  try {
    const decoded = await auth.verifyIdToken(token)
    if (!decoded.email?.endsWith(ALLOWED_DOMAIN)) {
      return res.status(403).json({ error: 'Email domain not allowed' })
    }
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export async function requireAdmin(req, res, next) {
  const snap = await db.collection('users').doc(req.user.uid).get()
  if (snap.data()?.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' })
  }
  next()
}