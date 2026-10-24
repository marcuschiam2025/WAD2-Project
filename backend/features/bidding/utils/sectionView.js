// Shapes a Section document for the Bidding screen (frontend core/data/bidding.js). Pure functions — unit test me.
import { SLOTS } from '../models/Section.js'

/**
 * "KELLY NGO" → "K. Ngo", "Prof. Lwin Khin Shar" → "L. Shar", "LEE, YUN" → "L. Yun"
 * @param {string} [prof]
 * @returns {string | undefined}
 */
export function shortProf(prof) {
  if (!prof) return prof

  const names = prof.replace('Prof. ', '').replace(/,/g, '').split(' ')
  if (names.length < 2) return prof

  const firstInitial = names[0].charAt(0).toUpperCase()
  const lastName = names[names.length - 1]
  const lastNameCased = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
  return `${firstInitial}. ${lastNameCased}`
}

/**
 * "SCIS Seminar Room 3-2" → "SCIS SR 3-2"
 * @param {string} [venue]
 * @returns {string | undefined}
 */
export function shortVenue(venue) {
  if (!venue) return venue
  return venue.replace('Seminar Room', 'SR')
}

/**
 * The index of the standard class block a meeting fills exactly, or null for other times
 * (e.g. a 10:00–11:30 language class)
 * @param {{ start: string, end: string }} meeting
 * @returns {number | null}
 */
export function slotOf(meeting) {
  for (let i = 0; i < SLOTS.length; i++) {
    if (SLOTS[i].start === meeting.start && SLOTS[i].end === meeting.end) return i
  }
  return null
}

/**
 * @param {object} section Section document
 * @returns {object} the section as the Bidding screen reads it. day / slot / venue describe the first
 * meeting (null when the section has no timetable); meetings has every weekly class with exact times.
 */
export function toSectionView(section) {
  const meetings = []
  for (const meeting of section.meetings ?? []) {
    meetings.push({ ...meeting, slot: slotOf(meeting), venueShort: shortVenue(meeting.venue) })
  }
  const first = meetings[0]
  const instructors = section.instructors ?? []

  // "K. Ngo", or "K. Ngo +1" when the section is co-taught
  let profShort = shortProf(instructors[0])
  if (instructors.length > 1) profShort += ` +${instructors.length - 1}`

  return {
    id: section.sectionId,
    module: section.module,
    section: section.section,
    term: section.term,
    session: section.session,
    title: section.title,
    topic: section.topic,
    day: first ? first.day : null,
    slot: first ? first.slot : null,
    start: first ? first.start : null,
    end: first ? first.end : null,
    meetings,
    prof: instructors.join(', ') || null,
    profShort: profShort ?? null,
    instructors,
    venue: first ? first.venue : null,
    venueShort: first ? first.venueShort : null,
    startDate: section.startDate,
    endDate: section.endDate,
    exam: section.exam ?? 'Not announced yet',
  }
}
