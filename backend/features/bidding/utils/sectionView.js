// Shapes a Section document for the Bidding screen (frontend core/data/bidding.js). Pure functions: unit test me.
import { EXAM_NOT_ANNOUNCED } from './sectionData.js';

/**
 * "Prof. Lwin Khin Shar" → "Prof. L. Shar"
 * @param {string} [prof]
 * @returns {string | undefined}
 */
export function shortProf(prof) {
  if (!prof) return prof;

  const names = prof.replace('Prof. ', '').split(' ');
  if (names.length < 2) return prof;

  const firstInitial = names[0].charAt(0);
  const lastName = names[names.length - 1];
  return `Prof. ${firstInitial}. ${lastName}`;
}

/**
 * "SCIS Seminar Room 3-2" → "SCIS SR 3-2"
 * @param {string} [venue]
 * @returns {string | undefined}
 */
export function shortVenue(venue) {
  if (!venue) return venue;
  return venue.replace('Seminar Room', 'SR');
}

/**
 * @param {object} section Section document
 * @returns {object} the section as the Bidding screen reads it
 */
export function toSectionView(section) {
  return {
    id: section.sectionId,
    archived: section.archived === true,
    module: section.module,
    section: section.section,
    day: section.day,
    slot: section.slot,
    prof: section.prof,
    profShort: shortProf(section.prof),
    venue: section.venue,
    venueShort: shortVenue(section.venue),
    term: section.term,
    sessions: section.sessions,
    capacity: section.capacity,
    examPeriod: section.examPeriod,
    exam: section.exam ?? EXAM_NOT_ANNOUNCED,
    startDate: section.startDate ?? null, // teaching dates, e.g. 2027-01-11 to 2027-04-18 (null for older rows)
    endDate: section.endDate ?? null,
  };
}
