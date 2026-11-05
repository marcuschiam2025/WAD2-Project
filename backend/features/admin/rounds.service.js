import { canonicalTerm } from '../bidding/utils/sectionData.js';
import { revisionFilter } from './changes.js';
import { httpError } from '../../middleware/errorHandler.js';
export function validateRound(input) {
  const fail = (message) => {
    throw httpError(400, message);
  };
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !['term', 'round', 'closesAt', 'revision'].includes(k))
  )
    fail('Unexpected round setting');
  revisionFilter('active', input.revision);
  let term;
  try {
    term = canonicalTerm(input.term);
  } catch {
    fail('Choose a valid academic term');
  }
  if (typeof input.round !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 -]{0,29}$/.test(input.round))
    fail('Enter a round name using letters, numbers, spaces or hyphens');
  if (
    typeof input.closesAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(input.closesAt)
  )
    fail('Closing time must include a timezone');
  const calendarDate = input.closesAt.slice(0, 10);
  const checkedDate = new Date(`${calendarDate}T00:00:00Z`);
  if (!Number.isFinite(checkedDate.getTime()) || checkedDate.toISOString().slice(0, 10) !== calendarDate)
    fail('Invalid closing date');
  const closesAt = new Date(input.closesAt);
  if (!Number.isFinite(closesAt.getTime())) fail('Invalid closing time');
  return { term, round: input.round.trim(), closesAt };
}
const snapshot = (row) =>
  row
    ? { _id: 'active', term: row.term, round: row.round, closesAt: row.closesAt, revision: row.revision ?? 0 }
    : null;
export function createRoundEditor({ change, read, terms, write }) {
  return {
    async save(actor, input) {
      if (actor?.role !== 'admin') throw httpError(403, 'Admins only');
      const data = validateRound(input);
      const result = await change(
        { actor, action: 'update', entity: 'bidding-round', entityId: 'active' },
        async (session) => {
          const before = await read(session);
          if ((before?.revision ?? 0) !== input.revision)
            throw httpError(409, 'Round settings changed. Reload before saving.');
          if (!(await terms(session)).includes(data.term))
            throw httpError(400, 'Choose a term with sections in the catalogue');
          const after = await write(before, data, session);
          if (!after) throw httpError(409, 'Round settings changed. Reload before saving.');
          return { before: snapshot(before), after: snapshot(after) };
        },
      );
      return result.after;
    },
  };
}
