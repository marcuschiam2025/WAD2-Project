// Calendar downloads can be imported into Google, Outlook or Apple Calendar.
import { sectionMeetings } from './clash'

const pad = n => String(n).padStart(2, '0')
const dateKey = date => `${date.getUTCFullYear()}${pad(date.getUTCMonth()+1)}${pad(date.getUTCDate())}`
const escapeText = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
const timeValid = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? '')

export function calendarStart(value, weeks) {
  const key = value instanceof Date ? `${value.getFullYear()}-${pad(value.getMonth()+1)}-${pad(value.getDate())}` : value
  const date = new Date(`${key}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key ?? '') || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== key) throw new Error('Choose a valid teaching start date.')
  if (date.getUTCDay() !== 1) throw new Error('Choose the Monday of the first teaching week.')
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 20) throw new Error('Teaching weeks must be a whole number from 1 to 20.')
  return date
}

// Fold content lines at 75 UTF-8 bytes, preserving multibyte characters.
function fold(line) {
  let result = '', length = 0
  const encoder = new TextEncoder()
  for (const char of line) {
    const size = encoder.encode(char).length
    if (length + size > 75) { result += '\r\n '; length = 1 }
    result += char
    length += size
  }
  return result
}

export function buildIcs(sections, termStart, weeks = 13) {
  const monday = calendarStart(termStart, weeks)
  if (!Array.isArray(sections) || !sections.length) throw new Error('No saved sections to export.')
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//BidMaxxer//Timetable//EN','CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE','TZID:Asia/Singapore','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:+0800','TZOFFSETTO:+0800','END:STANDARD','END:VTIMEZONE']
  const ids = new Set()
  for (const section of sections) {
    for (const meeting of sectionMeetings(section)) {
      if (!Number.isInteger(meeting.day) || meeting.day < 0 || meeting.day > 6 || !timeValid(meeting.start) || !timeValid(meeting.end) || meeting.start >= meeting.end) throw new Error('A saved section has invalid meeting data.')
      const first = new Date(monday)
      first.setUTCDate(first.getUTCDate() + meeting.day)
      const uid = `${section.id ?? `${section.module}-${section.section}`}-${dateKey(monday)}-${meeting.day}-${meeting.start.replace(':','')}@bidmaxxer.app`
      if (ids.has(uid)) continue
      ids.add(uid)
      const stamp = time => `${dateKey(first)}T${time.replace(':','')}00`
      lines.push('BEGIN:VEVENT',`UID:${escapeText(uid)}`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}`,
        `DTSTART;TZID=Asia/Singapore:${stamp(meeting.start)}`,`DTEND;TZID=Asia/Singapore:${stamp(meeting.end)}`,
        `RRULE:FREQ=WEEKLY;COUNT=${weeks}`,`SUMMARY:${escapeText(`${section.module} ${section.section} · ${section.name ?? ''}`)}`,
        `LOCATION:${escapeText(meeting.venue ?? section.venue)}`,'END:VEVENT')
    }
  }
  if (!ids.size) throw new Error('No saved sections to export.')
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function downloadFile(filename, content, type = 'text/calendar') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
