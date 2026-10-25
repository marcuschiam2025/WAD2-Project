// By the time these run, requireAuth has already put the logged-in user on req.user.

// Fields a student may edit about themselves (role is deliberately not here)
const EDITABLE = ['name', 'major', 'intakeYear', 'yearOfStudy', 'tracks', 'completedModules', 'basket', 'consents','bossBalance']

// GET /api/users/me
export function getProfile(req, res) {
  res.json(req.user)
}

// PATCH /api/users/me
export async function updateProfile(req, res) {
  for (const field of EDITABLE) {
    if (req.body[field] !== undefined) {
      req.user[field] = req.body[field]
    }
  }

  try {
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
