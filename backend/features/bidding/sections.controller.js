// Admin only (requireAdmin in bidding.routes.js): add, change and remove class sections.
// Students read sections through GET /api/bidding/sections in bidding.controller.js.
// Every change is logged (see features/audit).
// Note: `pnpm seed` rebuilds the sections from data/sections.json, replacing changes made here.
import Section from './models/Section.js'
import BidCart from './models/BidCart.js'
import Party from '../parties/models/Party.js'
import { httpError } from '../../middleware/errorHandler.js'
import { recordAudit } from '../audit/audit.service.js'

// Fields an admin may set. module, section and term identify the section, so they can't change:
// delete it and create a new one instead.
const SECTION_FIELDS = [
  'session',
  'title',
  'topic',
  'classNumber',
  'instructors',
  'meetings',
  'startDate',
  'endDate',
  'exam',
  'capacity',
]

// How a section appears in the audit log, since its id repeats every term: "AY26/27 T2 IS213-G1"
function auditId(section) {
  return `${section.term} ${section.sectionId}`
}

function copyFields(body, target) {
  for (const field of SECTION_FIELDS) {
    if (body[field] !== undefined) {
      target[field] = body[field]
    }
  }
}

// The term comes in the query, e.g. ?term=AY26/27 T2, since a section id repeats every term
async function findSectionOr404(req) {
  const term = req.query.term
  if (!term) {
    throw httpError(400, 'term is required')
  }
  const section = await Section.findOne({ sectionId: req.params.sectionId, term: term })
  if (!section) {
    throw httpError(404, `Section ${req.params.sectionId} not found in ${term}`)
  }
  return section
}

// POST /api/bidding/sections { module, section, term, meetings: [{ day, start, end, venue }], ... }
export async function createSection(req, res) {
  const module = String(req.body.module ?? '').trim().toUpperCase()
  const sectionCode = String(req.body.section ?? '').trim().toUpperCase()
  const term = String(req.body.term ?? '').trim()
  if (!module || !sectionCode || !term) {
    throw httpError(400, 'module, section and term are required')
  }

  const section = new Section({ sectionId: `${module}-${sectionCode}`, module, section: sectionCode, term })
  copyFields(req.body, section)
  await section.save() // the model checks the module exists; an existing section gives 409
  await recordAudit(req.user, 'create', 'sections', auditId(section), null, section)
  res.status(201).json(section)
}

// PATCH /api/bidding/sections/:sectionId?term=AY26/27 T2 { meetings?, instructors?, exam?, ... }
export async function updateSection(req, res) {
  const section = await findSectionOr404(req)
  const before = section.toObject()
  copyFields(req.body, section)
  await section.save()
  await recordAudit(req.user, 'update', 'sections', auditId(section), before, section)
  res.json(section)
}

// DELETE /api/bidding/sections/:sectionId?term=AY26/27 T2 — refused while a bid cart or room uses it
export async function deleteSection(req, res) {
  const section = await findSectionOr404(req)
  const id = section.sectionId

  const [carts, rooms] = await Promise.all([
    BidCart.countDocuments({ term: section.term, 'items.sectionId': id }),
    Party.countDocuments({ $or: [{ 'votes.sectionIds': id }, { finalisedSection: id }] }),
  ])

  const usedBy = []
  if (carts > 0) usedBy.push(`${carts} bid carts`)
  if (rooms > 0) usedBy.push(`${rooms} collab rooms`)
  if (usedBy.length > 0) {
    throw httpError(409, `${id} is still used by ${usedBy.join(', ')}`)
  }

  await section.deleteOne()
  await recordAudit(req.user, 'delete', 'sections', auditId(section), section, null)
  res.status(204).end()
}
