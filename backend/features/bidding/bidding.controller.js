import Section from './models/Section.js'
import BidHistory from './models/BidHistory.js'
import BidCart from './models/BidCart.js'
import Party from '../parties/models/Party.js'
import { referenceBid } from './utils/referenceBid.js'
import { findClashes } from './utils/clash.js'
import { httpError } from '../../middleware/errorHandler.js'

const CURRENT_TERM = 'AY24/25 T2'
const HISTORY_TERMS = 3

// GET /api/bidding/sections?module=IS212&term=AY24/25 T2
export async function listSections(req, res) {
  const filter = { term: req.query.term ?? CURRENT_TERM }
  if (req.query.module) filter.module = req.query.module
  res.json(await Section.find(filter).sort({ module: 1, day: 1, slot: 1 }))
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

// GET /api/bidding/cart?term=…
export async function getCart(req, res) {
  const cart = await BidCart.findOne({ user: req.user._id, term: req.query.term ?? CURRENT_TERM })
  res.json(cart ?? { term: req.query.term ?? CURRENT_TERM, items: [] })
}

// PUT /api/bidding/cart { term, items: [{ module, sectionId, amount }] } — returns any clashes
export async function saveCart(req, res) {
  const term = req.body.term ?? CURRENT_TERM
  const items = req.body.items ?? []
  const sections = await Section.find({ sectionId: { $in: items.map((i) => i.sectionId) } })
  if (sections.length !== items.length) throw httpError(400, 'Unknown section in cart')

  const cart = await BidCart.findOneAndUpdate(
    { user: req.user._id, term },
    { items },
    { upsert: true, new: true, runValidators: true },
  )
  res.json({ cart, clashes: findClashes(sections) })
}

// POST /api/bidding/validate-cart { sectionIds } — duplicate module, class time and final exam clashes
export async function validateCart(req, res) {
  const { sectionIds } = req.body
  if (!Array.isArray(sectionIds)) throw httpError(400, 'sectionIds must be an array')

  const uniqueIds = [...new Set(sectionIds)] // Remove duplicates
  const sections = await Section.find({ sectionId: { $in: uniqueIds } })
  if (sections.length !== uniqueIds.length) throw httpError(400, 'Some sections not found')

  // sections from different terms can't be in the same cart
  if (new Set(sections.map((s) => s.term)).size > 1) {
    throw httpError(400, 'All sections must be in the same term')
  }

  const summary = (s) => ({ sectionId: s.sectionId, section: s.section, module: s.module })
  // exam is a display string such as "28 Apr 2025 · 13:00 – 16:00", so only identical slots are caught
  const hasExam = (s) => s.exam && s.exam !== 'No final exam'

  const clashes = []
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const a = sections[i]
      const b = sections[j]

      if (a.module === b.module) {
        clashes.push({ type: 'duplicate-module', a: summary(a), b: summary(b) })
      }
      if (a.day === b.day && a.slot === b.slot) {
        clashes.push({ type: 'time', a: summary(a), b: summary(b), day: a.day, slot: a.slot })
      }
      if (hasExam(a) && a.exam === b.exam) {
        clashes.push({ type: 'final-exam-clash', a: summary(a), b: summary(b), finalExam: a.exam })
      }
    }
  }
  res.json({ valid: clashes.length === 0, clashes })
}

// GET /api/bidding/co-bids/:partyId — which party members are bidding for which section of the party's module
export async function getCoBids(req, res) {
  const party = await Party.findById(req.params.partyId).populate('members', 'name email')
  if (!party) throw httpError(404, 'Party not found')
  if (!party.members.some((m) => m._id.equals(req.user._id))) throw httpError(403, 'You are not a member of this party')

  const carts = await BidCart.find({ user: { $in: party.members.map((m) => m._id) }, term: CURRENT_TERM })
  const bySection = {}
  carts.forEach((cart) => {
    const member = party.members.find((m) => m._id.equals(cart.user))
    cart.items
      .filter((i) => i.module === party.module)
      .forEach((i) => (bySection[i.sectionId] ??= []).push({ id: member._id, name: member.name }))
  })
  res.json(Object.entries(bySection).map(([sectionId, members]) => ({ sectionId, members })))
}
