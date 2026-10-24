import Plan from '../planning/models/Plan.js'
import { loadSections, roundSettings } from './section.repository.js'
import { canonicalTerm, termLabel } from './utils/sectionData.js'
import { validateCartItems } from './utils/cartValidation.js'
import BidHistory from './models/BidHistory.js'
import BidCart from './models/BidCart.js'
import Party from '../parties/models/Party.js'
import { referenceBid } from './utils/referenceBid.js'
import { findClashes, findExamClashes } from './utils/clash.js'
import { toSectionView } from './utils/sectionView.js'
import { WEIGHTAGE } from './utils/weightage.js'
import { httpError } from '../../middleware/errorHandler.js'

const HISTORY_TERMS = 3
const DEFAULT_BALANCE = 210
async function selectedTerm(value) {
  const term = value ?? (await roundSettings()).term
  if (!term) throw httpError(409, 'No bidding catalogue term is available')
  try { return canonicalTerm(term) } catch { throw httpError(400, 'Invalid bidding term') }
}
async function requireOwnPlan(req, value) {
  const planId = requirePlanId(value)
  if (typeof planId !== 'string' || !/^[a-f0-9]{24}$/i.test(planId)) throw httpError(400, 'Invalid planId')
  if (!await Plan.exists({ _id: planId, user: req.user._id })) throw httpError(404, 'Plan not found')
  return planId
}
const termAliases = term => [term, termLabel(term)]

function getBalance(user) {
  if (user.balance !== undefined) return user.balance
  return DEFAULT_BALANCE
}

// Adds up the e$ amounts of the cart items
function getTotal(items) {
  let total = 0
  for (const item of items) {
    total += item.amount
  }
  return total
}

function requirePlanId(planId) {
  if (!planId) {
    throw httpError(400, 'planId is required')
  }
  return planId
}

// The saved bids for one plan in one term. An empty cart when the student has not saved one yet.
async function getCartFor(user, planId, term) {
  const cart = await BidCart.findOne({ user: user._id, plan: planId, term: { $in: termAliases(term) } })
  const items = cart ? cart.items : []
  return {
    planId,
    term,
    items,
    allocated: getTotal(items),
    balance: getBalance(user),
  }
}

// Finds one section in a list by its section id
function findSection(sections, sectionId) {
  for (const section of sections) {
    if (section.sectionId === sectionId) return section
  }
  return null
}

// GET /api/bidding/sections?modules=IS212,IS213&term=AY24/25 T2 — the screen's sections
// ?module=IS212 still works for one module
export async function listSections(req, res) {
  const term = await selectedTerm(req.query.term)
  const modules = String(req.query.modules ?? req.query.module ?? '').split(',').map(code => code.trim().toUpperCase()).filter(Boolean)
  res.json((await loadSections({ term, modules })).map(toSectionView))
}

// Catalogue fallback is labelled explicitly; no closing time or active round is invented.
export async function getRound(_req, res) {
  res.json(await roundSettings())
}

// GET /api/bidding/history/:module?round=1A
export async function getHistory(req, res) {
  const filter = { module: req.params.module }
  if (req.query.round) filter.round = req.query.round
  res.json(await BidHistory.find(filter).sort({ term: -1 }))
}

// GET /api/bidding/reference/:module?amount=42&round=1A — Safe / Competitive / At risk
export async function getReferenceBid(req, res) {
  const filter = { module: req.params.module }
  if (req.query.round) filter.round = req.query.round
  const history = await BidHistory.find(filter).sort({ term: -1 }).limit(HISTORY_TERMS)
  const amount = req.query.amount !== undefined ? Number(req.query.amount) : undefined
  res.json({ ...referenceBid(history, amount), history })
}

// GET /api/bidding/weightage/:module — assessment breakdown, [] when none is recorded
export function getWeightage(req, res) {
  res.json(WEIGHTAGE[req.params.module] ?? [])
}

// GET /api/bidding/cart?planId=…&term=… — the saved bids for one What-If plan
export async function getCart(req, res) {
  const planId = await requireOwnPlan(req, req.query.planId)
  const term = await selectedTerm(req.query.term)
  res.json(await getCartFor(req.user, planId, term))
}

// PUT /api/bidding/cart { planId, term, items: [{ module, sectionId, amount }] }
// Replaces the plan's cart. Rejects a section from another module, a module listed twice, and bids
// above the balance. Returns any clashes in the booked sections.
export async function saveCart(req, res) {
  const planId = await requireOwnPlan(req, req.body.planId)
  const term = await selectedTerm(req.body.term)
  const items = req.body.items ?? []
  const balance = getBalance(req.user)
  const total = validateCartItems(items, balance)
  const sections = await loadSections({ term, ids: items.map(item => item.sectionId) })
  if (sections.length !== items.length) throw httpError(400, 'Unknown section in cart for this term')
  for (const item of items) {
    const section = findSection(sections, item.sectionId)
    if (!section || section.module !== item.module) throw httpError(400, `${item.sectionId} is not a section of ${item.module} in ${term}`)
  }
  const clashes = findClashes(sections)
  const examClashes = findExamClashes(sections)
  if (clashes.length || examClashes.length) throw httpError(400, 'Resolve class or final-exam clashes before saving your bids')
  const cart = await BidCart.findOneAndUpdate(
    { user: req.user._id, plan: planId, term: { $in: termAliases(term) } },
    { items, term },
    { upsert: true, new: true, runValidators: true },
  )
  res.json({ cart, clashes, allocated: total, balance })
}

// DELETE /api/bidding/cart/:code?planId=…&term=… — takes one module out of the plan's cart
export async function dropCartItem(req, res) {
  const planId = await requireOwnPlan(req, req.query.planId)
  const term = await selectedTerm(req.query.term)
  await BidCart.updateOne(
    { user: req.user._id, plan: planId, term: { $in: termAliases(term) } },
    { $pull: { items: { module: req.params.code } } },
  )
  res.status(204).end()
}

// The fields the validation response shows for a section
function summary(section) {
  return { sectionId: section.sectionId, section: section.section, module: section.module }
}

// POST /api/bidding/validate-cart { sectionIds } — duplicate module, class time and final exam clashes
export async function validateCart(req, res) {
  const { sectionIds } = req.body
  if (!Array.isArray(sectionIds)) throw httpError(400, 'sectionIds must be an array')

  const uniqueIds = [...new Set(sectionIds)] // Remove duplicates
  if (uniqueIds.some(id => typeof id !== 'string')) throw httpError(400, 'Invalid section ID')
  const sections = await loadSections({ ids: uniqueIds })
  if (sections.length !== uniqueIds.length) throw httpError(400, 'Some sections not found')

  // Sections from different terms can't be in the same cart
  const terms = new Set()
  for (const section of sections) {
    terms.add(section.term)
  }
  if (terms.size > 1) {
    throw httpError(400, 'All sections must be in the same term')
  }

  const clashes = []
  const timePairs = new Set(findClashes(sections).map(pair => pair.join('|')))
  const examPairs = new Set(findExamClashes(sections).map(pair => pair.join('|')))
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const a = sections[i]
      const b = sections[j]

      if (a.module === b.module) {
        clashes.push({ type: 'duplicate-module', a: summary(a), b: summary(b) })
      }
      if (timePairs.has([a.sectionId,b.sectionId].join('|'))) {
        clashes.push({ type: 'time', a: summary(a), b: summary(b), day: a.day, slot: a.slot })
      }
      if (examPairs.has([a.sectionId,b.sectionId].join('|'))) {
        clashes.push({ type: 'final-exam-clash', a: summary(a), b: summary(b), finalExam: a.exam })
      }
    }
  }
  res.json({ valid: clashes.length === 0, clashes })
}

// Finds a party member by user id
function findMember(party, userId) {
  for (const member of party.members) {
    if (member._id.equals(userId)) return member
  }
  return null
}

// Whether a party member is already in a section's list
function isListed(list, memberId) {
  for (const entry of list) {
    if (entry.id.equals(memberId)) return true
  }
  return false
}

// GET /api/bidding/co-bids/:partyId — which party members are bidding for which section of the party's module
export async function getCoBids(req, res) {
  const party = await Party.findById(req.params.partyId).populate('members', 'name email')
  if (!party) throw httpError(404, 'Party not found')
  if (!findMember(party, req.user._id)) throw httpError(403, 'You are not a member of this party')

  const memberIds = []
  for (const member of party.members) {
    memberIds.push(member._id)
  }
  const carts = await BidCart.find({ user: { $in: memberIds }, term: { $in: termAliases(await selectedTerm(req.query.term)) } })

  // sectionId -> the party members bidding for it. A member with carts for two plans is listed once.
  const bySection = {}
  for (const cart of carts) {
    const member = findMember(party, cart.user)
    for (const item of cart.items) {
      if (item.module !== party.module) continue

      if (!bySection[item.sectionId]) bySection[item.sectionId] = []
      const list = bySection[item.sectionId]
      if (!isListed(list, member._id)) list.push({ id: member._id, name: member.name })
    }
  }

  const result = []
  for (const sectionId of Object.keys(bySection)) {
    result.push({ sectionId, members: bySection[sectionId] })
  }
  res.json(result)
}
