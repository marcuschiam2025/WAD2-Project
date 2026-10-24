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
  adminModules: (params = {}) => request('GET', `/admin/modules${query(params)}`),
  adminModule: (code) => request('GET', `/admin/modules/${encodeURIComponent(code)}`),
  createAdminModule: (data) => request('POST', '/admin/modules', data),
  updateAdminModule: (code, data) => request('PUT', `/admin/modules/${encodeURIComponent(code)}`, data),
  archiveAdminModule: (code, revision) => request('POST', `/admin/modules/${encodeURIComponent(code)}/archive`, { revision }),
  restoreAdminModule: (code, revision) => request('POST', `/admin/modules/${encodeURIComponent(code)}/restore`, { revision }),
  deleteAdminModule: (code, revision) => request('DELETE', `/admin/modules/${encodeURIComponent(code)}`, { revision }),
  adminSections: (module, term) => request('GET', `/admin/sections${query({ module, term })}`),
  createAdminSection: (data) => request('POST', '/admin/sections', data),
  updateAdminSection: (data) => request('PUT', `/admin/sections/${encodeURIComponent(data.termKey)}/${encodeURIComponent(data.moduleCode)}/${encodeURIComponent(data.sectionCode)}`, data),
  archiveAdminSection: (data) => request('POST', `/admin/sections/${encodeURIComponent(data.termKey)}/${encodeURIComponent(data.moduleCode)}/${encodeURIComponent(data.sectionCode)}/archive`, { revision: data.revision }),
  restoreAdminSection: (data) => request('POST', `/admin/sections/${encodeURIComponent(data.termKey)}/${encodeURIComponent(data.moduleCode)}/${encodeURIComponent(data.sectionCode)}/restore`, { revision: data.revision }),
  adminCurricula: () => request('GET', '/admin/curricula'),
  adminCurriculum: (id) => request('GET', `/admin/curricula/${encodeURIComponent(id)}`),
  updateAdminTrack: (major, id, data) => request('PUT', `/admin/curricula/${encodeURIComponent(major)}/tracks/${encodeURIComponent(id)}`, data),
  updateAdminRequirement: (major, id, data) => request('PUT', `/admin/curricula/${encodeURIComponent(major)}/requirements/${encodeURIComponent(id)}`, data),
  adminOverview: () => request('GET', '/admin'),
  adminAudit: (before) => request('GET', `/admin/audit${query({ before })}`),
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
  // Frontend rooms map to the backend's parties resource.
  rooms: () => request('GET', '/parties'),
  room: (id) => request('GET', `/parties/${id}`),
  createRoom: (room) => request('POST', '/parties', room),
  joinRoom: (inviteCode) => request('POST', '/parties/join', { inviteCode }),
  leaveRoom: (id) => request('DELETE', `/parties/${id}/members/me`),
  vote: (id, sectionIds, term) => request('PUT', `/parties/${id}/votes`, { sectionIds, term }),
  confirmRoom: (id, sectionId, revision) => request('POST', `/parties/${id}/finalise`, { sectionId, revision }),
  removeRoomMember: (id, memberId, revision) => request('DELETE', `/parties/${id}/members/${memberId}`, { revision }),
  transferRoom: (id, userId, revision) => request('POST', `/parties/${id}/owner`, { userId, revision }),
  roomHandoff: (id, data) => request('POST', `/parties/${id}/handoff`, data),
  roomVotes: (id) => request('GET', `/parties/${id}/votes`),
  roomUpdates: (id, since) => request('GET', `/parties/${id}/updates?since=${since}`),

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
