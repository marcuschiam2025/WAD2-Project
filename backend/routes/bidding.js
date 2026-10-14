import { Router } from 'express'
import Section from '../models/Section.js'
import BidHistory from '../models/BidHistory.js'
import BidCart from '../models/BidCart.js'
import Room from '../models/Room.js'
import { referenceBid } from '../utils/referenceBid.js'
import { findClashes } from '../utils/clash.js'
import { httpError } from '../middleware/errorHandler.js'

const router = Router()

const CURRENT_TERM = 'AY24/25 T2'
const HISTORY_TERMS = 3

// GET /api/bidding/sections?module=IS212&term=AY24/25 T2
router.get('/sections', async (req, res) => {
  const filter = { term: req.query.term ?? CURRENT_TERM }
  if (req.query.module) filter.module = req.query.module
  res.json(await Section.find(filter).sort({ module: 1, day: 1, slot: 1 }))
})

// GET /api/bidding/history/:module?round=1A
router.get('/history/:module', async (req, res) => {
  const filter = { module: req.params.module }
  if (req.query.round) filter.round = req.query.round
  res.json(await BidHistory.find(filter).sort({ term: -1 }))
})

// GET /api/bidding/reference/:module?amount=42&round=1A — Safe / Competitive / At risk
router.get('/reference/:module', async (req, res) => {
  const filter = { module: req.params.module }
  if (req.query.round) filter.round = req.query.round
  const history = await BidHistory.find(filter).sort({ term: -1 }).limit(HISTORY_TERMS)
  const amount = req.query.amount !== undefined ? Number(req.query.amount) : undefined
  res.json({ ...referenceBid(history, amount), history })
})

// GET /api/bidding/cart?term=…
router.get('/cart', async (req, res) => {
  const cart = await BidCart.findOne({ user: req.user._id, term: req.query.term ?? CURRENT_TERM })
  res.json(cart ?? { term: req.query.term ?? CURRENT_TERM, items: [] })
})

// PUT /api/bidding/cart { term, items: [{ module, sectionId, amount }] } — returns any clashes
router.put('/cart', async (req, res) => {
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
})

// GET /api/bidding/co-bids/:roomId — which room members are bidding for which section of the room's module
router.get('/co-bids/:roomId', async (req, res) => {
  const room = await Room.findById(req.params.roomId).populate('members', 'name email')
  if (!room) throw httpError(404, 'Room not found')
  if (!room.members.some((m) => m._id.equals(req.user._id))) throw httpError(403, 'You are not a member of this room')

  const carts = await BidCart.find({ user: { $in: room.members.map((m) => m._id) }, term: CURRENT_TERM })
  const bySection = {}
  carts.forEach((cart) => {
    const member = room.members.find((m) => m._id.equals(cart.user))
    cart.items
      .filter((i) => i.module === room.module)
      .forEach((i) => (bySection[i.sectionId] ??= []).push({ id: member._id, name: member.name }))
  })
  res.json(Object.entries(bySection).map(([sectionId, members]) => ({ sectionId, members })))
})

export default router
