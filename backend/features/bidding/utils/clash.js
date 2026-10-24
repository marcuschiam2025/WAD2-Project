// Timetable clash detection: two sections clash when any of their weekly meetings overlap in time,
// on the same day, while both sections are running (a half-term "1A" section only runs for 7 weeks).

// Whether two date ranges ("YYYY-MM-DD") overlap. Unknown dates count as overlapping.
function datesOverlap(a, b) {
  if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) return true
  return a.startDate <= b.endDate && b.startDate <= a.endDate
}

/**
 * The first pair of meetings that overlap, or null. "HH:MM" times compare correctly as strings,
 * and a class ending at 11:30 does not clash with one starting at 11:30.
 * @param {{ meetings?: Array<{ day: number, start: string, end: string }>, startDate?: string, endDate?: string }} a
 * @param {typeof a} b
 * @returns {{ day: number, a: object, b: object } | null}
 */
export function findMeetingClash(a, b) {
  if (!datesOverlap(a, b)) return null

  for (const meetingA of a.meetings ?? []) {
    for (const meetingB of b.meetings ?? []) {
      const sameDay = meetingA.day === meetingB.day
      const overlap = meetingA.start < meetingB.end && meetingB.start < meetingA.end
      if (sameDay && overlap) {
        return { day: meetingA.day, a: meetingA, b: meetingB }
      }
    }
  }
  return null
}

/**
 * @param {Array<{ sectionId: string, meetings?: Array<object> }>} sections
 * @returns {Array<[string, string]>} clashing sectionId pairs
 */
export function findClashes(sections) {
  const clashes = []
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const a = sections[i]
      const b = sections[j]
      if (findMeetingClash(a, b)) {
        clashes.push([a.sectionId, b.sectionId])
      }
    }
  }
  return clashes
}
