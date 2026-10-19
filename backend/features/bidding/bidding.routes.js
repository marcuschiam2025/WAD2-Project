import { Router } from 'express'
import * as bidding from './bidding.controller.js'

const router = Router()

router.get('/sections', bidding.listSections)
router.get('/history/:module', bidding.getHistory)
router.get('/reference/:module', bidding.getReferenceBid)
router.get('/cart', bidding.getCart)
router.put('/cart', bidding.saveCart)
router.post('/validate-cart', bidding.validateCart)
router.get('/co-bids/:partyId', bidding.getCoBids)

export default router
