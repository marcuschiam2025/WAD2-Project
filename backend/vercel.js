import app from './app.js'
import { connectDB } from './config/db.js'

// Vercel owns the HTTP listener; connect once when this instance starts.
await connectDB()

export default app
