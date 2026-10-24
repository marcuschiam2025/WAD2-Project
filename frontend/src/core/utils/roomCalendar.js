// Exact meeting ranges form rows; alternatives share a cell instead of covering
// one another. A section keeps one ballot ID across all of its weekly meetings.
export function roomCalendar(rows) {
  const ranges = new Map()
  for (const row of rows) {
    for (const meeting of row.section.sessions ?? []) {
      const key = `${meeting.start}-${meeting.end}`
      if (!ranges.has(key)) ranges.set(key, { start: meeting.start, end: meeting.end, days: Array.from({ length: 7 }, () => []) })
      ranges.get(key).days[meeting.day].push({ ...row, meeting })
    }
  }
  return [...ranges.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
}
