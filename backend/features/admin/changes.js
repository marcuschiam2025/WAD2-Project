import { httpError } from '../../middleware/errorHandler.js';

// All writes and their audit entry must share the caller's MongoDB transaction.
// Callbacks must use the supplied session for every read/write and be retry-safe.
export function createAuditedChange({ transaction, writeAudit }) {
  return async function auditedChange({ actor, action, entity, entityId }, mutate) {
    if (actor?.role !== 'admin') throw httpError(403, 'Admins only');
    return transaction(async (session) => {
      const result = await mutate(session);
      await writeAudit(
        {
          actorId: String(actor._id),
          actorName: actor.name || actor.email || String(actor._id),
          action,
          entity,
          entityId: String(entityId),
          before: result.before ?? null,
          after: result.after ?? null,
        },
        session,
      );
      return result;
    });
  };
}

// Legacy catalogue rows have no revision. Mutations must match this filter,
// increment revision atomically, and return 409 if another save won the race.
export function revisionFilter(id, revision) {
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw httpError(400, 'A valid record revision is required');
  return revision === 0
    ? { _id: id, $or: [{ revision: 0 }, { revision: { $exists: false } }] }
    : { _id: id, revision };
}
