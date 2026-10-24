// Thin client for the Express backend (see backend/routes). In dev, Vite proxies /api to :4000.
// Each request obtains the current Firebase ID token from the auth store.

const BASE = import.meta.env.VITE_API_URL ?? '/api'

let idToken = null
let tokenProvider = null
export function setToken(token) { idToken = token }
export function setTokenProvider(provider) { tokenProvider = provider }

// Thrown for every failed call. status is 0 when the backend could not be reached at all.
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(method, path, body) {
  const token = tokenProvider ? await tokenProvider() : idToken
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  savedBidPlans: (term) => request('GET', `/bidding/plans${query({ term })}`),
  cart: (planId, term) => request('GET', `/bidding/cart${query({ planId, term })}`),
  // { planId, term, items: [{ module, sectionId, amount }] }
  saveCart: (cart) => request('PUT', '/bidding/cart', cart),
  dropFromCart: (moduleCode, planId, term) =>
    request('DELETE', `/bidding/cart/${moduleCode}${query({ planId, term })}`),
  validateCart: (sectionIds) => request('POST', '/bidding/validate-cart', { sectionIds }),

  // Google Calendar
  exportCalendar: (accessToken, sectionIds, termStart, weeks = 13) => request('POST', '/calendar/export', { accessToken, sectionIds, termStart, weeks }),
}
