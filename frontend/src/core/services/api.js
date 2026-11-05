// Thin client for the Express backend (see backend/routes). In dev, Vite proxies /api to :4000.
// Each request obtains the current Firebase ID token from the auth store.

const BASE = import.meta.env.VITE_API_URL ?? '/api';

let idToken = null;
let tokenProvider = null;
export function setToken(token) {
  idToken = token;
}
export function setTokenProvider(provider) {
  tokenProvider = provider;
}

// Thrown for every failed call. status is 0 when the backend could not be reached at all.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const UNREACHABLE = 'Could not reach the BidMaxxer server. Check your connection and try again in a moment.';
const RETRY_DELAY_MS = 1500;

async function request(method, path, body) {
  const token = tokenProvider ? await tokenProvider() : idToken;
  const send = () =>
    fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  let res;
  try {
    try {
      res = await send();
    } catch (error) {
      // The server may only be restarting. A read changes nothing, so it is safe to ask once more before giving up;
      // a save is never repeated, because the first attempt might have reached the server.
      if (method !== 'GET') throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      res = await send();
    }
  } catch {
    throw new ApiError(UNREACHABLE, 0);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new ApiError(err.error ?? `${method} ${path} failed (${res.status})`, res.status), {
      code: err.code,
      issues: err.issues ?? [],
    });
  }
  return res.status === 204 ? null : res.json();
}

// ?a=1&b=2, leaving out empty values
function query(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
}

export const api = {
  adminRound: () => request('GET', '/admin/bidding-round'),
  saveAdminRound: (data) => request('PUT', '/admin/bidding-round', data),
  adminModules: (params = {}) => request('GET', `/admin/modules${query(params)}`),
  adminModule: (code) => request('GET', `/admin/modules/${encodeURIComponent(code)}`),
  createAdminModule: (data) => request('POST', '/admin/modules', data),
  updateAdminModule: (code, data) => request('PUT', `/admin/modules/${encodeURIComponent(code)}`, data),
  archiveAdminModule: (code, revision) =>
    request('POST', `/admin/modules/${encodeURIComponent(code)}/archive`, { revision }),
  restoreAdminModule: (code, revision) =>
    request('POST', `/admin/modules/${encodeURIComponent(code)}/restore`, { revision }),
  deleteAdminModule: (code, revision) =>
    request('DELETE', `/admin/modules/${encodeURIComponent(code)}`, { revision }),
  adminSections: (module, term) => request('GET', `/admin/sections${query({ module, term })}`),
  createAdminSection: (data) => request('POST', '/admin/sections', data),
  updateAdminSection: (data) =>
    request(
      'PUT',
      `/admin/sections/${encodeURIComponent(data.termKey)}/${encodeURIComponent(data.moduleCode)}/${encodeURIComponent(data.sectionCode)}`,
      data,
    ),
  archiveAdminSection: (data) =>
    request(
      'POST',
      `/admin/sections/${encodeURIComponent(data.termKey)}/${encodeURIComponent(data.moduleCode)}/${encodeURIComponent(data.sectionCode)}/archive`,
      { revision: data.revision },
    ),
  restoreAdminSection: (data) =>
    request(
      'POST',
      `/admin/sections/${encodeURIComponent(data.termKey)}/${encodeURIComponent(data.moduleCode)}/${encodeURIComponent(data.sectionCode)}/restore`,
      { revision: data.revision },
    ),
  adminCurricula: () => request('GET', '/admin/curricula'),
  adminCurriculum: (id) => request('GET', `/admin/curricula/${encodeURIComponent(id)}`),
  updateAdminTrack: (major, id, data) =>
    request('PUT', `/admin/curricula/${encodeURIComponent(major)}/tracks/${encodeURIComponent(id)}`, data),
  updateAdminRequirement: (major, id, data) =>
    request(
      'PUT',
      `/admin/curricula/${encodeURIComponent(major)}/requirements/${encodeURIComponent(id)}`,
      data,
    ),
  adminOverview: () => request('GET', '/admin'),
  adminAudit: (before) => request('GET', `/admin/audit${query({ before })}`),
  // Users / profile
  me: () => request('GET', '/users/me'),
  updateMe: (data) => request('PATCH', '/users/me', data),

  // Catalogue
  majors: (school) => request('GET', `/majors${query({ school })}`),
  majorRequirements: (id) => request('GET', `/majors/${encodeURIComponent(id)}/requirements`),
  // { q, category, fulfils, school, limit }
  modules: (params = {}) => request('GET', `/modules${query(params)}`),
  module: (code) => request('GET', `/modules/${encodeURIComponent(code)}`),

  // Track Finder quiz
  quizQuestionsV2: () => request('GET', '/quiz/v2/questions'),
  submitQuizV2: (submission) => request('POST', '/quiz/v2/attempts', submission),
  quizAttemptsV2: () => request('GET', '/quiz/v2/attempts'),
  quizModulesV2: (id) => request('GET', `/quiz/v2/attempts/${encodeURIComponent(id)}/recommendations`),
  quizExplanationV2: (id) => request('GET', `/quiz/v2/attempts/${encodeURIComponent(id)}/explanation`),

  // What-If plans
  plans: () => request('GET', '/plans'),
  createPlan: (plan) => request('POST', '/plans', plan),
  updatePlan: (id, plan) => request('PUT', `/plans/${id}`, plan),
  deletePlan: (id) => request('DELETE', `/plans/${id}`),

  // Collab rooms
  // Frontend rooms map to the backend's parties resource.
  rooms: () => request('GET', '/parties'),
  room: (id) => request('GET', `/parties/${id}`),
  // { name, module, termKey: "2026-27_T2", maxMembers? } -> { party }
  createRoom: (room) => request('POST', '/parties', room),
  joinRoom: (inviteCode) => request('POST', '/parties/join', { inviteCode }),
  leaveRoom: (id) => request('DELETE', `/parties/${id}/members/me`),
  // The sections I'd be happy with (replaces my old vote) -> every member's votes
  vote: (id, sectionIds) => request('PUT', `/parties/${id}/votes`, { sectionIds }),
  // Party admin only: locks one section for the whole room, or unlocks it again
  lockRoom: (id, sectionId) => request('POST', `/parties/${id}/lock`, { sectionId }),
  unlockRoom: (id) => request('DELETE', `/parties/${id}/lock`),
  // Every section of the room's module: [{ section, voteCount, voters }]
  roomSections: (id) => request('GET', `/parties/${id}/sections`),
  // Owner only: remove a member and stop them rejoining (unban lets them back in)
  banRoomMember: (id, userId) => request('POST', `/parties/${id}/ban`, { userId }),
  // Party admin only: hands the role to another member
  transferRoomAdmin: (id, userId) => request('PUT', `/parties/${id}/owner`, { userId }),

  notifications: (before) => request('GET', `/notifications${query({ before })}`),
  markNotificationRead: (id) => request('PATCH', `/notifications/${id}/read`),

  // BOSS bidding
  round: () => request('GET', '/bidding/round'),
  biddingWindows: (term) => request('GET', `/bidding/windows${query({ term })}`),
  sections: (moduleCodes, term) =>
    request('GET', `/bidding/sections${query({ modules: moduleCodes.join(','), term })}`),
  bidHistory: (moduleCode, round) => request('GET', `/bidding/history/${moduleCode}${query({ round })}`),
  // { rating: 'safe' | 'competitive' | 'at-risk' | null, suggested, mean, sd, basedOn, history }. With term, only
  // the terms before it count. round is required.
  referenceBid: (moduleCode, amount, round, term) =>
    request('GET', `/bidding/reference/${moduleCode}${query({ amount, round, term })}`),
  // The same for one section, matched on its instructors and class times:
  // { ...referenceBid, low, high, matchLevel: 'prof-slot' | 'prof' | 'module' | null, history: [{ term, median, min, sections }], section }
  sectionReferenceBid: (sectionId, amount, round, term) =>
    request('GET', `/bidding/reference-bid${query({ sectionId, amount, round, term })}`),
  weightage: (moduleCode) => request('GET', `/bidding/weightage/${moduleCode}`),
  savedBidPlans: (term) => request('GET', `/bidding/plans${query({ term })}`),
  cart: (planId, term) => request('GET', `/bidding/cart${query({ planId, term })}`),
  // { planId, term, items: [{ module, sectionId, amount }] }
  saveCart: (cart) => request('PUT', '/bidding/cart', cart),
  dropFromCart: (moduleCode, planId, term) =>
    request('DELETE', `/bidding/cart/${moduleCode}${query({ planId, term })}`),

  // Google Calendar
  // termStart (Monday of the first teaching week) is only needed for sections without teaching dates
  exportCalendar: (accessToken, sectionIds, termStart, weeks = 13) =>
    request('POST', '/calendar/export', {
      accessToken,
      sectionIds,
      termStart: termStart || undefined,
      weeks,
    }),
};
