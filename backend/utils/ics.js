// Builds an .ics calendar file for a timetable so it can be imported into Google Calendar.
// The one-click Google Calendar API export lives in the backend (POST /api/calendar/export).
import { slots } from '../data/bidding'

const pad = (n) => String(n).padStart(2, '0')

function stamp(date, time) {
  const [h, m] = time.split(':')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${h}${m}00`
}

/**
 * @param {Array<{ module, section, day, slot, venue, name }>} sessions
 * @param {Date} termStart Monday of week 1
 * @param {number} weeks number of teaching weeks
 */
export function buildIcs(sessions, termStart, weeks = 13) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BidMaxxer//Timetable//EN', 'CALSCALE:GREGORIAN']
  sessions.forEach((s) => {
    const first = new Date(termStart)
    first.setDate(first.getDate() + s.day)
    const { start, end } = slots[s.slot]
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.module}-${s.section}-${termStart.getTime()}@bidmaxxer.app`,
      `DTSTAMP:${stamp(new Date(), '00:00')}Z`,
      `DTSTART;TZID=Asia/Singapore:${stamp(first, start)}`,
      `DTEND;TZID=Asia/Singapore:${stamp(first, end)}`,
      `RRULE:FREQ=WEEKLY;COUNT=${weeks}`,
      `SUMMARY:${s.module} ${s.section} · ${s.name}`,
      `LOCATION:${s.venue}`,
      'END:VEVENT',
    )
  })
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadFile(filename, content, type = 'text/calendar') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
