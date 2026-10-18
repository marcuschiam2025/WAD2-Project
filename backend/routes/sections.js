import express from "express";
import * as sectionsController from "../controller/sectionsController.js";

const router = express.Router();

// READ sections available for a particular course code
// GET /api/bidding/sections
router.get("/sections", sectionsController.readSection);

// POST /api/bidding/validate-cart
router.post("/validate-cart", sectionsController.validateCartClashes);

export default router;
