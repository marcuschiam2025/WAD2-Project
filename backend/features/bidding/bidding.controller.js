import Section from './models/Section.js'
import BidHistory from './models/BidHistory.js'
import BidCart from './models/BidCart.js'
import Party from '../parties/models/Party.js'
import { referenceBid } from './utils/referenceBid.js'
import { findClashes, findMeetingClash } from './utils/clash.js'
import { toSectionView } from './utils/sectionView.js'
import { WEIGHTAGE } from './utils/weightage.js'
import { httpError } from '../../middleware/errorHandler.js'

const CURRENT_ROUND = '1A'
const HISTORY_TERMS = 3
// Used until the User model stores a balance (the Bidding screen shows e$ 210)
const DEFAULT_BALANCE = 210
// TODO: store the round in the database. BIDDING_ROUND_CLOSES_AT overrides the closing time.
const ROUND_CLOSES_AT = process.env.BIDDING_ROUND_CLOSES_AT ?? '2025-01-20T12:00:00+08:00'

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

// The term comes from the frontend, e.g. "AY26/27 T2"
function requireTerm(term) {
  if (!term) {
    throw httpError(400, 'term is required')
  }
  return term
}

// The saved bids for one plan in one term. An empty cart when the student has not saved one yet.
async function getCartFor(user, planId, term) {
  const cart = await BidCart.findOne({ user: user._id, plan: planId, term: term })
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

// GET /api/bidding/sections?modules=IS212,IS213&term=AY26/27 T2 — the screen's sections
// ?module=IS212 still works for one module
export async function listSections(req, res) {
  const filter = { term: requireTerm(req.query.term) }

  // "IS212, is213" becomes ["IS212", "IS213"]
  const modules = []
  const requested = String(req.query.modules ?? '').split(',')
  for (const code of requested) {
    const cleaned = code.trim().toUpperCase()
    if (cleaned) modules.push(cleaned)
  }

  if (modules.length > 0) {
    filter.module = { $in: modules }
  } else if (req.query.module) {
    filter.module = req.query.module
  }

  const sections = await Section.find(filter).sort({ module: 1, sectionId: 1 }).lean()

  const result = []
  for (const section of sections) {
    result.push(toSectionView(section))
  }
  res.json(result)
}

// GET /api/bidding/round — the BOSS round the planner is bidding in
export function getRound(_req, res) {
  res.json({ round: CURRENT_ROUND, closesAt: ROUND_CLOSES_AT })
}

// GET /api/bidding/history/:module?round=1A
export async function getHistory(req, res) {
  const filter = { module: req.params.module.toUpperCase() }
  if (req.query.round) filter.round = req.query.round
  res.json(await BidHistory.find(filter).sort({ term: -1 }))
}

// GET /api/bidding/reference/:module?amount=42&round=1A&term=AY26/27 T2 — Safe / Competitive / At risk
// round is required: medians from different rounds can't be averaged together.
// With term, only the terms before it count ("AY25/26 T2" < "AY26/27 T1" as strings)
export async function getReferenceBid(req, res) {
  if (!req.query.round) throw httpError(400, 'round is required')

  let amount
  if (req.query.amount !== undefined) {
    amount = Number(req.query.amount)
    if (req.query.amount === '' || Number.isNaN(amount)) throw httpError(400, 'amount must be a number')
  }

  const filter = { module: req.params.module.toUpperCase(), round: req.query.round }
  if (req.query.term) filter.term = { $lt: req.query.term }
  const history = await BidHistory.find(filter).sort({ term: -1 }).limit(HISTORY_TERMS)
  res.json({ ...referenceBid(history, amount), history })
}

// GET /api/bidding/weightage/:module — assessment breakdown, [] when none is recorded
export function getWeightage(req, res) {
  res.json(WEIGHTAGE[req.params.module] ?? [])
}

// GET /api/bidding/cart?planId=…&term=… — the saved bids for one What-If plan
export async function getCart(req, res) {
  const planId = requirePlanId(req.query.planId)
  const term = requireTerm(req.query.term)
  res.json(await getCartFor(req.user, planId, term))
}

// PUT /api/bidding/cart { planId, term, items: [{ module, sectionId, amount }] }
// Replaces the plan's cart. Rejects a section from another module, a module listed twice, and bids
// above the balance. Returns any clashes in the booked sections.
export async function saveCart(req, res) {
  const planId = requirePlanId(req.body.planId)
  const term = requireTerm(req.body.term)
  const items = req.body.items ?? []

  // A module can only be in the cart once
  const seenModules = new Set()
  for (const item of items) {
    if (seenModules.has(item.module)) {
      throw httpError(400, 'Each module can only be in the cart once')
    }
    seenModules.add(item.module)
  }

  // Load every section the cart names
  const sectionIds = []
  for (const item of items) {
    sectionIds.push(item.sectionId)
  }
  const sections = await Section.find({ sectionId: { $in: sectionIds }, term: term })
  if (sections.length !== items.length) {
    throw httpError(400, 'Unknown section in cart')
  }

  // Each section must belong to the module it is listed under, in this term
  for (const item of items) {
    const section = findSection(sections, item.sectionId)
    if (!section || section.module !== item.module || section.term !== term) {
      throw httpError(400, `${item.sectionId} is not a section of ${item.module} in ${term}`)
    }
  }

  const total = getTotal(items)
  const balance = getBalance(req.user)
  if (total > balance) {
    throw httpError(400, `e$ ${total} is more than your balance of e$ ${balance}`)
  }

  const cart = await BidCart.findOneAndUpdate(
    { user: req.user._id, plan: planId, term: term },
    { items: items },
    { upsert: true, new: true, runValidators: true },
  )
  res.json({ cart, clashes: findClashes(sections), allocated: total, balance })
}

// DELETE /api/bidding/cart/:code?planId=…&term=… — takes one module out of the plan's cart
export async function dropCartItem(req, res) {
  const planId = requirePlanId(req.query.planId)
  const term = requireTerm(req.query.term)
  await BidCart.updateOne(
    { user: req.user._id, plan: planId, term: term },
    { $pull: { items: { module: req.params.code } } },
  )
  res.status(204).end()
}

// The fields the validation response shows for a section
function summary(section) {
  return { sectionId: section.sectionId, section: section.section, module: section.module, title: section.title }
}

// exam is a display string such as "28 Apr 2025 · 13:00 – 16:00", so only identical slots are caught
function hasExam(section) {
  return section.exam && section.exam !== 'No final exam'
}

// POST /api/bidding/validate-cart { sectionIds, term } — duplicate module, class time and final exam clashes
export async function validateCart(req, res) {
  const { sectionIds } = req.body
  if (!Array.isArray(sectionIds)) throw httpError(400, 'sectionIds must be an array')
  const term = requireTerm(req.body.term)

  const uniqueIds = [...new Set(sectionIds)] // Remove duplicates
  const sections = await Section.find({ sectionId: { $in: uniqueIds }, term: term })
  if (sections.length !== uniqueIds.length) {
    // Name the ones that are missing, e.g. a typo or a section from another term
    const missing = []
    for (const id of uniqueIds) {
      if (!findSection(sections, id)) missing.push(id)
    }
    throw httpError(400, `Not sections in ${term}: ${missing.join(', ')}`)
  }

  const clashes = []
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const a = sections[i]
      const b = sections[j]

      if (a.module === b.module) {
        clashes.push({ type: 'duplicate-module', a: summary(a), b: summary(b) })
      }
      const timeClash = findMeetingClash(a, b)
      if (timeClash) {
        clashes.push({ type: 'time', a: summary(a), b: summary(b), day: timeClash.day, times: [timeClash.a, timeClash.b] })
      }
      if (hasExam(a) && a.exam === b.exam) {
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

// GET /api/bidding/co-bids/:partyId?term=AY26/27 T2 — which party members are bidding for which section of the party's module
export async function getCoBids(req, res) {
  const term = requireTerm(req.query.term)
  const party = await Party.findById(req.params.partyId).populate('members', 'name email')
  if (!party) throw httpError(404, 'Party not found')
  if (!findMember(party, req.user._id)) throw httpError(403, 'You are not a member of this party')

  const memberIds = []
  for (const member of party.members) {
    memberIds.push(member._id)
  }
  const carts = await BidCart.find({ user: { $in: memberIds }, term: term })

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
