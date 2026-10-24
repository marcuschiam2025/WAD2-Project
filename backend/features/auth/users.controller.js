// By the time these run, requireAuth has already put the logged-in user on req.user.

import { profileUpdate } from './utils/profile.js'

// GET /api/users/me
export function getProfile(req, res) {
  res.json(req.user)
}

// PATCH /api/users/me
export async function updateProfile(req, res) {
  try {
    Object.assign(req.user, profileUpdate(req.body, req.user))
    await req.user.save()
  } catch (error) {
    // e.g. yearOfStudy outside 1-5
    return res.status(400).json({ error: error.message })
  }
  res.json(req.user)
}

// GET /api/users/admin-check (admins only)
export function adminCheck(req, res) {
  res.json({ message: `Hello admin ${req.user.email}` })
}
