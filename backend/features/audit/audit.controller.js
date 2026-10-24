import AuditEntry from './models/AuditEntry.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

// GET /api/audit?collection=modules&record=IS213&limit=50&before=<entry id> — newest first.
// Pass the last entry's _id as before to get the next page.
export async function listAudit(req, res) {
  const filter = {}
  if (req.query.collection) {
    filter.collectionName = String(req.query.collection)
  }
  if (req.query.record) {
    filter.recordId = String(req.query.record)
  }
  if (req.query.before) {
    filter._id = { $lt: String(req.query.before) } // ObjectIds grow over time
  }

  let limit = Number(req.query.limit) || DEFAULT_LIMIT
  limit = Math.min(Math.max(limit, 1), MAX_LIMIT)

  const entries = await AuditEntry.find(filter).sort({ _id: -1 }).limit(limit)
  res.json(entries)
}
