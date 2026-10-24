import { Router } from 'express'
import * as parties from './parties.controller.js'

const router = Router()

router.get('/', parties.listParties)
router.post('/', parties.createParty)
router.post('/join', parties.joinParty)
router.get('/:id', parties.getParty)
router.get('/:id/updates', parties.getUpdates)
router.delete('/:id/members/me', parties.leaveParty)
router.delete('/:id/members/:memberId', parties.removeMember)
router.post('/:id/owner', parties.transferOwner)
router.post('/:id/ban', parties.banMember)
router.put('/:id/votes', parties.saveVotes)
router.get('/:id/votes', parties.getVotes)
router.post('/:id/finalise', parties.finaliseSection)
router.post('/:id/handoff', parties.prepareHandoff)
router.post('/:id/comments', parties.addComment)

export default router
