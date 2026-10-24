import { loadSections } from '../bidding/section.repository.js'
import { findClashes, findExamClashes } from '../bidding/utils/clash.js'
import { httpError } from '../../middleware/errorHandler.js'

const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TIMEZONE = 'Asia/Singapore'

function isoLocal(monday, day, time) {
  const date = new Date(monday)
  date.setUTCDate(date.getUTCDate() + day)
  return `${date.toISOString().slice(0,10)}T${time}:00`
}

// Requires a separate Google OAuth access token with calendar.events permission.
// Firebase ID tokens used to sign into BidMaxxer cannot authorise this request.
export async function exportTimetable(req, res) {
  const { accessToken, sectionIds, termStart, weeks = 13 } = req.body
  if (typeof accessToken !== 'string' || !accessToken.trim()) throw httpError(400, 'accessToken with the calendar.events scope is required')
  if (!Array.isArray(sectionIds) || !sectionIds.length || sectionIds.length > 20 || sectionIds.some(id => typeof id !== 'string' || !id.trim())) throw httpError(400, 'Provide between 1 and 20 sectionIds')
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 20) throw httpError(400, 'weeks must be a whole number from 1 to 20')
  const monday = new Date(`${termStart}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(termStart ?? '') || !Number.isFinite(monday.getTime()) || monday.toISOString().slice(0,10) !== termStart) throw httpError(400, 'termStart must be a valid YYYY-MM-DD date')
  if (monday.getUTCDay() !== 1) throw httpError(400, 'termStart must be the Monday of the first teaching week')
  const ids = [...new Set(sectionIds)]
  const sections = await loadSections({ ids })
  if (sections.length !== ids.length) throw httpError(400, 'Some sections are no longer available')
  if (new Set(sections.map(s => s.term)).size > 1) throw httpError(400, 'All sections must belong to one term')
  if (new Set(sections.map(s => s.module)).size !== sections.length) throw httpError(400, 'Choose only one section per module')
  if (findClashes(sections).length || findExamClashes(sections).length) throw httpError(400, 'Resolve class and exam clashes before exporting')
  const created = []
  for (const section of sections) {
    for (const meeting of section.sessions) {
      const response = await fetch(GOOGLE_EVENTS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: `${section.module} ${section.section}`,
          location: meeting.venue,
          description: section.prof ? `Instructor: ${section.prof}` : undefined,
          start: { dateTime: isoLocal(monday, meeting.day, meeting.start), timeZone: TIMEZONE },
          end: { dateTime: isoLocal(monday, meeting.day, meeting.end), timeZone: TIMEZONE },
          recurrence: [`RRULE:FREQ=WEEKLY;COUNT=${weeks}`],
        }),
      })
      if (!response.ok) throw httpError(502, `Google Calendar rejected ${section.sectionId} (${response.status}). ${created.length} meeting series were already created; check your calendar before retrying.`)
      created.push((await response.json()).id)
    }
  }
  res.status(201).json({ created: created.length, eventIds: created })
}
