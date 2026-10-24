// Thin client for the Express backend (see backend/routes). In dev, Vite proxies /api to :4000.
// The Pinia stores currently use sample data from backend/data; swap their TODOs for these calls.

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

  // Collab rooms
  rooms: () => request('GET', '/rooms'),
  room: (id) => request('GET', `/rooms/${id}`),
  createRoom: (room) => request('POST', '/rooms', room),
  joinRoom: (inviteCode) => request('POST', '/rooms/join', { inviteCode }),
  leaveRoom: (id) => request('DELETE', `/rooms/${id}/members/me`),
  vote: (id, sectionIds) => request('PUT', `/rooms/${id}/votes`, { sectionIds }),
  roomUpdates: (id, since) => request('GET', `/rooms/${id}/updates?since=${since}`),

  // BOSS bidding. term is BOSS's label, e.g. "AY26/27 T2" (encoded, since it has a slash and a space)
  round: () => request('GET', '/bidding/round'),
  sections: (moduleCodes, term) =>
    request('GET', `/bidding/sections?modules=${[].concat(moduleCodes).join(',')}&term=${encodeURIComponent(term)}`),
  bidHistory: (moduleCode, round) => request('GET', `/bidding/history/${moduleCode}${round ? `?round=${round}` : ''}`),
  referenceBid: (moduleCode, amount, round, term) =>
    request('GET', `/bidding/reference/${moduleCode}?amount=${amount}&round=${round}&term=${encodeURIComponent(term)}`),
  weightage: (moduleCode) => request('GET', `/bidding/weightage/${moduleCode}`),
  cart: (planId, term) => request('GET', `/bidding/cart?planId=${planId}&term=${encodeURIComponent(term)}`),
  saveCart: (planId, term, items) => request('PUT', '/bidding/cart', { planId, term, items }),
  dropCartItem: (planId, term, moduleCode) =>
    request('DELETE', `/bidding/cart/${moduleCode}?planId=${planId}&term=${encodeURIComponent(term)}`),
  // { valid, clashes: [{ type: 'duplicate-module' | 'time' | 'final-exam-clash', a, b, ... }] }
  validateCart: (sectionIds, term) => request('POST', '/bidding/validate-cart', { sectionIds, term }),

  // Google Calendar
  exportCalendar: (accessToken, sectionIds, term, termStart) =>
    request('POST', '/calendar/export', { accessToken, sectionIds, term, termStart }),
}
