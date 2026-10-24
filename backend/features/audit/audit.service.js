import AuditEntry from './models/AuditEntry.js'

// A plain copy of a document for the log (null stays null)
function snapshot(doc) {
  if (!doc) return null
  return typeof doc.toObject === 'function' ? doc.toObject() : doc
}

// The top-level fields whose values differ between two snapshots
export function changedFields(before, after) {
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const changed = []
  for (const field of fields) {
    if (field === '_id' || field === '__v') continue // ids and Mongo's version counter aren't edits
    if (JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field])) {
      changed.push(field)
    }
  }
  return changed
}

/**
 * Records one admin change. Call it after the change has been saved.
 * Usage: await recordAudit(req.user, 'update', 'modules', mod._id, before, mod)
 */
export async function recordAudit(user, action, collectionName, recordId, before, after) {
  const beforeCopy = snapshot(before)
  const afterCopy = snapshot(after)

  // An update that didn't change anything isn't worth a log entry
  const changes = action === 'update' ? changedFields(beforeCopy, afterCopy) : []
  if (action === 'update' && changes.length === 0) return

  await AuditEntry.create({
    user: user._id,
    email: user.email,
    action,
    collectionName,
    recordId: String(recordId),
    changes,
    before: beforeCopy,
    after: afterCopy,
  })
}
