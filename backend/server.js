import { connectDB } from './config/db.js'
import app from './app.js'

const PORT = process.env.PORT ?? 4000

connectDB()
  .then(() => app.listen(PORT, () => console.log(`BidMaxxer API listening on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Failed to start:', err.message)
    process.exit(1)
  })
