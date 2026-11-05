// Matches an upcoming section to past BOSS bid results. Pure functions: unit test me.
// Used by scripts/build-bid-history.js (to build the keys) and the reference bid API (to match on them).

// Joins a co-taught section's names. Not a comma: BOSS names can contain one ("LEE, YUN").
const NAME_SEPARATOR = '; ';

// How closely the past results match the section, most specific first
export const MATCH_LEVELS = ['prof-slot', 'prof', 'module'];

/**
 * "  kelly   ngo " → "KELLY NGO"
 * @param {string} name
 */
function cleanName(name) {
  return name.replace(/\s+/g, ' ').trim().toUpperCase();
}

/**
 * The same set of instructors always gives the same key, whatever order BOSS lists them in.
 * ['KELLY NGO', 'BENJAMIN LEE'] → "BENJAMIN LEE; KELLY NGO". null when there are no names.
 * @param {string[]} names
 * @returns {string | null}
 */
export function instructorKey(names) {
  const unique = new Set();
  for (const name of names ?? []) {
    const cleaned = cleanName(name ?? '');
    if (cleaned) unique.add(cleaned);
  }
  if (unique.size === 0) return null;
  return [...unique].sort().join(NAME_SEPARATOR);
}

/**
 * The weekly class times of a section: day (0 = Monday) and start time.
 * [{ day: 3, start: '08:15' }, { day: 0, start: '08:15' }] → "0-08:15|3-08:15"
 * A section with no fixed class time (SMU-X, work-study) gives "", which is still a known timing.
 * @param {Array<{ day: number, start: string }>} meetings
 * @returns {string}
 */
export function slotKey(meetings) {
  const slots = new Set();
  for (const meeting of meetings ?? []) {
    slots.add(`${meeting.day}-${meeting.start}`);
  }
  return [...slots].sort().join('|');
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Only the first window of a round that cleared bids counts for each section: that is when the
 * round is contested, and later windows are mostly left-over seats.
 * @param {Array<object>} rows SectionBidResult rows
 */
function firstWindows(rows) {
  const first = new Map();
  for (const row of rows) {
    const key = `${row.term}|${row.section}`;
    const kept = first.get(key);
    if (!kept || row.window < kept.window) first.set(key, row);
  }
  return [...first.values()];
}

/**
 * One entry per term: the median of the matching sections' medians and the lowest min,
 * newest term first.
 * @param {Array<object>} rows
 */
function byTerm(rows) {
  const terms = new Map();
  for (const row of firstWindows(rows)) {
    if (!terms.has(row.term)) terms.set(row.term, []);
    terms.get(row.term).push(row);
  }

  const history = [];
  for (const [term, sections] of terms) {
    history.push({
      term,
      median: Math.round(median(sections.map((row) => row.median)) * 100) / 100,
      min: Math.min(...sections.map((row) => row.min)),
      sections: sections
        .map((row) => row.section)
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true })),
    });
  }
  return history.sort((a, b) => b.term.localeCompare(a.term));
}

/**
 * Picks the most specific past results that exist for a section, falling back level by level:
 *   prof-slot  same module, same set of instructors, same class times, same round
 *   prof       same module, same set of instructors, same round (any time: the only option for
 *              terms without a class schedule)
 *   module     same module, same round (every section)
 * @param {Array<object>} rows SectionBidResult rows for the module and round, terms before the one bid for
 * @param {{ instructorKey: string | null, slotKey: string | null }} target the section being bid for
 * @param {number} [maxTerms] how many of the latest terms to keep
 * @returns {{ matchLevel: string | null, history: Array<object> }}
 */
export function matchHistory(rows, target, maxTerms = 3) {
  const sameProf = (row) => target.instructorKey !== null && row.instructorKey === target.instructorKey;
  const filters = {
    'prof-slot': (row) => sameProf(row) && target.slotKey !== null && row.slotKey === target.slotKey,
    prof: sameProf,
    module: () => true,
  };

  for (const level of MATCH_LEVELS) {
    const history = byTerm(rows.filter(filters[level]));
    if (history.length > 0) return { matchLevel: level, history: history.slice(0, maxTerms) };
  }
  return { matchLevel: null, history: [] };
}
