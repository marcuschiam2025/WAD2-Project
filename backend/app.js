import express from 'express'
import cors from 'cors'
import apiRoutes from './routes/index.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { requireAuth, requireAdmin } from './middleware/auth.js'

const app = express()

app.get('/api/auctions', requireAuth, (req, res) => { /* logged-in users */ })
app.delete('/api/auctions/:id', requireAuth, requireAdmin, (req, res) => { /* admins only */ })

app.use(cors({ origin: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',') }))
app.use(express.json())

app.use('/api', apiRoutes)
app.use(notFound)
app.use(errorHandler)

export default app
