// Timetable clash detection: two sections clash when they share a day and session slot.

/**
 * @param {Array<{ sectionId: string, day: number, slot: number }>} sections
 * @returns {Array<[string, string]>} clashing sectionId pairs
 */
export function findClashes(sections) {
  const clashes = []
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const a = sections[i]
      const b = sections[j]
      if (a.day === b.day && a.slot === b.slot) {
        clashes.push([a.sectionId, b.sectionId])
      }
    }
  }
  return clashes
}
