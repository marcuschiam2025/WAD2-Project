import mongoose from 'mongoose'
import Party from './models/Party.js'
import { httpError } from '../../middleware/errorHandler.js'

// Runs before every /:id route.
// Finds the party in the URL and stores it on req.party, or stops with a 404.
export async function loadParty(req, res, next) {
  const partyId = req.params.id

  // "abc" is not a valid ObjectId: treat it as "not found" instead of a server error
  if (!mongoose.isValidObjectId(partyId)) {
    throw httpError(404, 'Party not found')
  }

  const party = await Party.findById(partyId)
  if (!party) {
    throw httpError(404, 'Party not found')
  }

  req.party = party
  next()
}

// Use after loadParty. Stops the request unless the signed-in user is in the party.
export function requireMember(req, res, next) {
  const userId = req.user._id
  const isMember = req.party.members.some((memberId) => memberId.equals(userId))

  if (!isMember) {
    throw httpError(403, 'You are not a member of this party')
  }
  next()
}

// Use after loadParty. Stops the request unless the signed-in user owns the party.
export function requireOwner(req, res, next) {
  if (!req.party.owner.equals(req.user._id)) {
    throw httpError(403, 'Only the party owner can do this')
  }
  next()
}

// Use after loadParty. Stops the request while the owner has locked the party.
export function requireUnlocked(req, res, next) {
  if (req.party.locked) {
    throw httpError(409, 'This party is locked. Ask the party owner to unlock it first.')
  }
  next()
}