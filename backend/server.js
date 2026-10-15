import express from 'express'
import cors from 'cors'
import { connectDB } from './config/db.js'
import apiRoutes from './routes/index.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

const app = express()

app.use(cors({ origin: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',') }))
app.use(express.json())

app.use('/api', apiRoutes)
app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT ?? 4000

connectDB()
  .then(() => app.listen(PORT, () => console.log(`BidMaxxer API listening on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Failed to start:', err.message)
    process.exit(1)
  })

export default app
