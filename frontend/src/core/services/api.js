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
    throw Object.assign(new Error(err.error ?? `${method} ${path} failed (${res.status})`), {
      status: res.status, code: err.code, issues: err.issues ?? [],
    })
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
  quizQuestionsV2: () => request('GET', '/quiz/v2/questions'),
  submitQuizV2: (submission) => request('POST', '/quiz/v2/attempts', submission),
  quizAttemptsV2: () => request('GET', '/quiz/v2/attempts'),
  quizModulesV2: (id) => request('GET', `/quiz/v2/attempts/${encodeURIComponent(id)}/recommendations`),

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

  // BOSS bidding
  sections: (moduleCode) => request('GET', `/bidding/sections?module=${moduleCode}`),
  bidHistory: (moduleCode) => request('GET', `/bidding/history/${moduleCode}`),
  referenceBid: (moduleCode, amount, round) =>
    request('GET', `/bidding/reference/${moduleCode}?amount=${amount}&round=${round}`),
  cart: () => request('GET', '/bidding/cart'),
  saveCart: (cart) => request('PUT', '/bidding/cart', cart),

  // Google Calendar
  exportCalendar: (accessToken, sectionIds) => request('POST', '/calendar/export', { accessToken, sectionIds }),
}
