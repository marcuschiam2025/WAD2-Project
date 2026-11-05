import { Router } from 'express';
import * as bidding from './bidding.controller.js';

const router = Router();

router.get('/sections', bidding.listSections);
router.get('/round', bidding.getRound);
router.get('/windows', bidding.getWindows);
router.get('/history/:module', bidding.getHistory);
router.get('/reference/:module', bidding.getReferenceBid);
router.get('/reference-bid', bidding.getSectionReferenceBid);
router.get('/weightage/:module', bidding.getWeightage);
router.get('/plans', bidding.listSavedPlans);
router.get('/cart', bidding.getCart);
router.put('/cart', bidding.saveCart);
router.delete('/cart/:code', bidding.dropCartItem);
router.get('/co-bids/:partyId', bidding.getCoBids);

export default router;
