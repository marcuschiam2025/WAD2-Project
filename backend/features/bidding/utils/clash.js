// Timetable clash detection: two sections clash when they share a day and session slot.

/**
 * @param {Array<{ sectionId: string, day: number, slot: number }>} sections
 * @returns {Array<[string, string]>} clashing sectionId pairs
 */
export function findClashes(sections) {
  const clashes = []
  sections.forEach((a, i) => {
    sections.slice(i + 1).forEach((b) => {
      if (a.day === b.day && a.slot === b.slot) clashes.push([a.sectionId, b.sectionId])
    })
  })
  return clashes
}
