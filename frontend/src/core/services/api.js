// Thin client for the Express backend (see backend/routes). In dev, Vite proxies /api to :4000.
// The stores call these and fall back to the sample data in core/data when the backend can't be reached.

const BASE = import.meta.env.VITE_API_URL ?? '/api'

// Until Firebase sign-in is wired up, the backend's dev bypass (AUTH_DEV_BYPASS=true) identifies the
// student by this header instead of a token. Set VITE_DEV_UID in frontend/.env to act as another student.
const DEV_UID = import.meta.env.VITE_DEV_UID ?? 'dev-user'

let idToken = null
// Call after Firebase sign-in: setToken(await user.getIdToken())
// TODO(Backend 2): set this from the Firebase sign-in in the user store
export function setToken(token) {
  idToken = token
}

// Thrown for every failed call. status is 0 when the backend could not be reached at all.
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(method, path, body) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : { 'x-dev-uid': DEV_UID }),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Could not reach the BidMaxxer server', 0)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new ApiError(err.error ?? `${method} ${path} failed (${res.status})`, res.status), {
      code: err.code, issues: err.issues ?? [],
    })
  }
  return res.status === 204 ? null : res.json()
}

// ?a=1&b=2, leaving out empty values
function query(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  return entries.length ? `?${new URLSearchParams(entries)}` : ''
}

export const api = {
  // Users / profile
  me: () => request('GET', '/users/me'),
  updateMe: (data) => request('PATCH', '/users/me', data),

  // Catalogue
  majors: (school) => request('GET', `/majors${query({ school })}`),
  majorRequirements: (id) => request('GET', `/majors/${encodeURIComponent(id)}/requirements`),
  tracks: (major) => request('GET', `/tracks${query({ major })}`),
  // { q, category, fulfils, school, limit }
  modules: (params = {}) => request('GET', `/modules${query(params)}`),
  module: (code) => request('GET', `/modules/${encodeURIComponent(code)}`),

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
  // TODO(Backend 2): the backend has /api/parties; the rooms store still runs on sample data
  rooms: () => request('GET', '/rooms'),
  room: (id) => request('GET', `/rooms/${id}`),
  createRoom: (room) => request('POST', '/rooms', room),
  joinRoom: (code) => request('POST', '/rooms/join', { code }),
  leaveRoom: (id) => request('DELETE', `/rooms/${id}/members/me`),
  vote: (id, sectionIds) => request('PUT', `/rooms/${id}/votes`, { sectionIds }),
  roomUpdates: (id, since) => request('GET', `/rooms/${id}/updates?since=${since}`),

  // BOSS bidding
  round: () => request('GET', '/bidding/round'),
  sections: (moduleCodes, term) => request('GET', `/bidding/sections${query({ modules: moduleCodes.join(','), term })}`),
  bidHistory: (moduleCode, round) => request('GET', `/bidding/history/${moduleCode}${query({ round })}`),
  referenceBid: (moduleCode, amount, round) =>
    request('GET', `/bidding/reference/${moduleCode}${query({ amount, round })}`),
  weightage: (moduleCode) => request('GET', `/bidding/weightage/${moduleCode}`),
  cart: (planId, term) => request('GET', `/bidding/cart${query({ planId, term })}`),
  // { planId, term, items: [{ module, sectionId, amount }] }
  saveCart: (cart) => request('PUT', '/bidding/cart', cart),
  dropFromCart: (moduleCode, planId, term) =>
    request('DELETE', `/bidding/cart/${moduleCode}${query({ planId, term })}`),
  validateCart: (sectionIds) => request('POST', '/bidding/validate-cart', { sectionIds }),

  // Google Calendar
  exportCalendar: (accessToken, sectionIds) => request('POST', '/calendar/export', { accessToken, sectionIds }),
}
