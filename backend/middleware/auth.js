//import the objects from the firebase.js file
import { auth, db } from '../config/firebase.js'

const ALLOWED_DOMAIN = '@smu.edu.sg'

export async function requireAuth(req, res, next) {
//getting token from the request
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null
  if (!token) return res.status(401).json({ error: 'Not logged in' })

//^if no token error, else, verify the token:
  try {
    const decoded = await auth.verifyIdToken(token)
    if (!decoded.email?.endsWith(ALLOWED_DOMAIN)) {
      return res.status(403).json({ error: 'Email domain not allowed' })
    }
    req.user = decoded //assigns token contents (eg userId) to the request which can be accessed by other functions
    next() // will allow request to be passed to the next routes in ../routes/index.js
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}


//========= to delete =========
//not in use(admin will be done by mongo not firebase):
export async function requireAdmin(req, res, next) {
  const snap = await db.collection('users').doc(req.user.uid).get()
  if (snap.data()?.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' })
  }
  next()
//^^^^^^^^^ to delete ^^^^^^^^^
}