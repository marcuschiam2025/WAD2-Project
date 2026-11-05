// By the time these run, requireAuth has already put the logged-in user on req.user.

import { profileUpdate } from './utils/profile.js';
import { semestersDue } from './utils/academicCalendar.js';

// The student's profile, plus how many semesters have ended that the frontend should move them past
function profileResponse(user) {
  return { ...user.toJSON(), semestersDue: semestersDue(user) };
}

// GET /api/users/me
export function getProfile(req, res) {
  res.json(profileResponse(req.user));
}

// PATCH /api/users/me
export async function updateProfile(req, res) {
  try {
    Object.assign(req.user, profileUpdate(req.body, req.user));
    await req.user.save();
  } catch (error) {
    if (error.name === 'ValidationError' || !error.name || error.name === 'Error') {
      return res.status(400).json({ error: error.message }); // bad input
    }
    throw error; // anything else: let the error handler report it as a server error
  }
  res.json(profileResponse(req.user));
}
