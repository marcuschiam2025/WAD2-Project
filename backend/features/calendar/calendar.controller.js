// TODO: the plan is to connect to Microsoft (Outlook calendar through the Microsoft Graph API)
// instead of Google, but this is not confirmed yet. Until then, export still goes to Google Calendar.
import Section from '../bidding/models/Section.js'
import { httpError } from '../../middleware/errorHandler.js'

const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TIMEZONE = 'Asia/Singapore'

function isoLocal(dateStr, dayOffset, time) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + dayOffset)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}:00`
}

// POST /api/calendar/export { accessToken, sectionIds, term, termStart: 'YYYY-MM-DD' (Monday of week 1), weeks }
// accessToken is the student's Google OAuth token with the calendar.events scope (from Firebase sign-in).
export async function exportTimetable(req, res) {
  const { accessToken, sectionIds = [], term, termStart, weeks = 13 } = req.body
  if (!accessToken) throw httpError(400, 'accessToken with the calendar.events scope is required')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(termStart ?? '')) throw httpError(400, 'termStart must be YYYY-MM-DD')

  const filter = { sectionId: { $in: sectionIds } }
  if (term) filter.term = term
  const sections = await Section.find(filter)
  const created = []
  // One weekly event per class meeting. Sections without a timetable (work-study, SMU-X) add nothing.
  for (const s of sections) {
    for (const meeting of s.meetings) {
      const response = await fetch(GOOGLE_EVENTS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: `${s.module} ${s.section}`,
          location: meeting.venue,
          description: s.instructors.length ? `Instructor: ${s.instructors.join(', ')}` : undefined,
          start: { dateTime: isoLocal(termStart, meeting.day, meeting.start), timeZone: TIMEZONE },
          end: { dateTime: isoLocal(termStart, meeting.day, meeting.end), timeZone: TIMEZONE },
          recurrence: [`RRULE:FREQ=WEEKLY;COUNT=${weeks}`],
        }),
      })
      if (!response.ok) throw httpError(502, `Google Calendar rejected ${s.sectionId} (${response.status})`)
      created.push((await response.json()).id)
    }
  }
  res.status(201).json({ created: created.length, eventIds: created })
}
