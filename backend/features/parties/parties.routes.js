import { Router } from 'express'
import * as parties from './parties.controller.js'
import { loadParty, requireMember, requireOwner } from './parties.middleware.js' //consider moving the parties middleware to the middleware folder

const router = Router()

// Routes for one party: loadParty finds it, then a check decides who may continue
router.get('/:id', loadParty, requireMember, parties.getParty)
router.delete('/:id', loadParty, requireOwner, parties.deleteParty)
router.get('/:id/updates', loadParty, requireMember, parties.getUpdates)

// Members
router.delete('/:id/members/me', loadParty, requireMember, parties.leaveParty)
router.post('/:id/ban', loadParty, requireOwner, parties.banMember)
router.delete('/:id/ban/:userId', loadParty, requireOwner, parties.unbanMember)

// Sections: votes (sections I like) and my section (the one I'm going for)
router.put('/:id/votes', loadParty, requireMember, parties.saveVotes)
router.put('/:id/my-section', loadParty, requireMember, parties.setMySection)
router.delete('/:id/my-section', loadParty, requireMember, parties.clearMySection)
router.get('/:id/sections', loadParty, requireMember, parties.getSectionSummary)

export default router
