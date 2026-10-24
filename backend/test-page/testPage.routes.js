// TEMPORARY: serves a login test page at http://localhost:4000/test
// Delete this folder (and its line in app.js) once the real frontend handles login.
import express, { Router } from 'express'

const router = Router()

// GET /test/config — the Firebase web config the page needs to sign in.
// These values are public (they end up in every frontend anyway), unlike the service account key.
router.get('/config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_WEB_API_KEY,
    authDomain: `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: process.env.FIREBASE_PROJECT_ID,
  })
})

// GET /test — the page itself (test-page/index.html)
router.use(express.static(import.meta.dirname))

export default router
