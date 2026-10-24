import { Router } from 'express'
import * as bidding from './bidding.controller.js'
import * as sections from './sections.controller.js'
import { requireAdmin } from '../../middleware/auth.js'

const router = Router()

router.get('/sections', bidding.listSections)
// Admins only; :sectionId routes take ?term=, e.g. /sections/IS213-G1?term=AY26/27 T2
router.post('/sections', requireAdmin, sections.createSection)
router.patch('/sections/:sectionId', requireAdmin, sections.updateSection)
router.delete('/sections/:sectionId', requireAdmin, sections.deleteSection)
router.get('/round', bidding.getRound)
router.get('/history/:module', bidding.getHistory)
router.get('/reference/:module', bidding.getReferenceBid)
router.get('/weightage/:module', bidding.getWeightage)
router.get('/cart', bidding.getCart)
router.put('/cart', bidding.saveCart)
router.delete('/cart/:code', bidding.dropCartItem)
router.post('/validate-cart', bidding.validateCart)
router.get('/co-bids/:partyId', bidding.getCoBids)

export default router
