import { Router } from 'express'
import * as parties from './parties.controller.js'
import { loadParty, requireMember, requireOwner,requireUnlocked } from './parties.middleware.js' //consider moving the parties middleware to the middleware folder

const router = Router()

router.get('/', parties.listParties) // parties I'm in
router.post('/', parties.createParty) // create a party
router.post('/join', parties.joinParty) // join with an invite code

// Routes for one party: loadParty finds it, then a check decides who may continue
router.get('/:id', loadParty, requireMember, parties.getParty)
router.delete('/:id', loadParty, requireOwner, parties.deleteParty)
router.get('/:id/updates', loadParty, requireMember, parties.getUpdates)

// Members
router.delete('/:id/members/me', loadParty, requireMember, parties.leaveParty)
router.post('/:id/ban', loadParty, requireOwner, parties.banMember)
router.delete('/:id/ban/:userId', loadParty, requireOwner, parties.unbanMember)

// Sections: votes (sections I like) and my section (the one I'm going for)
router.put('/:id/votes', loadParty, requireMember,requireUnlocked, parties.saveVotes)
router.delete('/:id/votes', loadParty, requireMember,requireUnlocked, parties.clearVotes)
router.put('/:id/my-section', loadParty, requireMember,requireUnlocked, parties.setMySection)
router.delete('/:id/my-section', loadParty, requireMember,requireUnlocked, parties.clearMySection)
router.get('/:id/sections', loadParty, requireMember, parties.getSectionSummary)

// The owner's lock: freezes the whole party once everyone has voted
router.get('/:id/decision', loadParty, requireMember, parties.getDecision)
router.post('/:id/lock', loadParty, requireOwner, requireUnlocked, parties.lockParty)
router.delete('/:id/lock', loadParty, requireOwner, parties.unlockParty)

export default router
