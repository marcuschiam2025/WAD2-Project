// Thin client for the Express backend (see backend/features). In dev, Vite proxies /api to :4000.
// The Pinia stores currently use sample data from src/data; swap their TODOs for these calls.

const BASE = import.meta.env.VITE_API_URL ?? '/api'

let idToken = null
// Call after Firebase sign-in: setToken(await user.getIdToken())
export function setToken(token) {
  idToken = token
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(idToken && { Authorization: `Bearer ${idToken}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `${method} ${path} failed (${res.status})`)
  }
  return res.status === 204 ? null : res.json()
}

export const api = {
  // Users / profile
  me: () => request('GET', '/users/me'),
  updateMe: (data) => request('PATCH', '/users/me', data),

  // Catalogue
  tracks: (intake) => request('GET', `/tracks${intake ? `?intake=${intake}` : ''}`),
  modules: (params = '') => request('GET', `/modules${params}`),

  // Track Finder quiz
  quizQuestions: () => request('GET', '/quiz/questions'),
  submitQuiz: (answers) => request('POST', '/quiz/attempts', { answers }),
  quizAttempts: () => request('GET', '/quiz/attempts'),

  // What-If plans
  plans: () => request('GET', '/plans'),
  createPlan: (plan) => request('POST', '/plans', plan),
  updatePlan: (id, plan) => request('PUT', `/plans/${id}`, plan),
  deletePlan: (id) => request('DELETE', `/plans/${id}`),
  checkPlan: (id) => request('GET', `/plans/${id}/check`),

  // Parties
  parties: () => request('GET', '/parties'),
  party: (id) => request('GET', `/parties/${id}`),
  createParty: (party) => request('POST', '/parties', party),
  joinParty: (inviteCode) => request('POST', '/parties/join', { inviteCode }),
  leaveParty: (id) => request('DELETE', `/parties/${id}/members/me`),
  vote: (id, sectionIds) => request('PUT', `/parties/${id}/votes`, { sectionIds }),
  partyUpdates: (id, since) => request('GET', `/parties/${id}/updates?since=${since}`),

  // BOSS bidding
  sections: (moduleCode) => request('GET', `/bidding/sections?module=${moduleCode}`),
  bidHistory: (moduleCode) => request('GET', `/bidding/history/${moduleCode}`),
  referenceBid: (moduleCode, amount, round) =>
    request('GET', `/bidding/reference/${moduleCode}?amount=${amount}&round=${round}`),
  cart: () => request('GET', '/bidding/cart'),
  saveCart: (cart) => request('PUT', '/bidding/cart', cart),
  validateCart: (sectionIds) => request('POST', '/bidding/validate-cart', { sectionIds }),

  // Google Calendar
  exportCalendar: (accessToken, sectionIds) => request('POST', '/calendar/export', { accessToken, sectionIds }),
}
