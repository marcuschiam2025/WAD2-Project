export function createRequireAuth({ auth, User }) {
  const ALLOWED_DOMAIN = '@smu.edu.sg'

  // Runs before every protected route.
  // 1. Reads the Firebase token from the "Authorization: Bearer <token>" header
  // 2. Asks Firebase if the token is real
  // 3. Loads the user from MongoDB (creates them on their first login)
  // 4. Puts the user on req.user so controllers can use it
  return async function requireAuth(req, res, next) {
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

    const isStudentDomain = firebaseUser.email?.toLowerCase().endsWith(ALLOWED_DOMAIN)
    if (!isStudentDomain) {
      const existing = await User.findOne({ firebaseUid: firebaseUser.uid })
      if (!firebaseUser.email || existing?.role !== 'admin' || firebaseUser.email_verified !== true ||
          firebaseUser.firebase?.sign_in_provider !== 'google.com') {
        return res.status(403).json({ error: 'Use an SMU account or a provisioned staff Google account' })
      }
      req.user = existing
      return next()
    }

    // 3. Get the user from MongoDB (the database code lives in models/User.js)
    req.user = await User.findOrCreate(firebaseUser)

    // 4. Hand over to the next function
    next()
  }

}
