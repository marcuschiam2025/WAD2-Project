import { auth } from '../config/firebase.js'
import User from '../features/auth/models/User.js'
import { createRequireAuth } from './authentication.js'
export { requireAdmin } from './admin.js'

export const requireAuth = createRequireAuth({ auth, User })
