import express from 'express'
import cors from 'cors'
import apiRoutes from './routes/index.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

const app = express()

// Only let our frontend (CLIENT_ORIGIN in .env) call the API from a browser
app.use(cors({ origin: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',') }))
// Parse JSON request bodies into req.body
app.use(express.json())

// All API routes, see routes/index.js
app.use('/api', apiRoutes)

// TEMPORARY: login test page at http://localhost:4000/test (delete test-page/ and these lines when done)
if (process.env.NODE_ENV !== 'production') {
  const { default: testPageRoutes } = await import('./test-page/testPage.routes.js')
  app.use('/test', testPageRoutes)
}

// Anything not matched above gets a 404, and thrown errors become JSON error responses
app.use(notFound)
app.use(errorHandler)

export default app
