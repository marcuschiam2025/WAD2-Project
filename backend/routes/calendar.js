import { Router } from 'express'
import Section, { SLOTS } from '../models/Section.js'
import { httpError } from '../middleware/errorHandler.js'

const router = Router()

const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TIMEZONE = 'Asia/Singapore'

function isoLocal(dateStr, dayOffset, time) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + dayOffset)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}:00`
}

// POST /api/calendar/export { accessToken, sectionIds, termStart: 'YYYY-MM-DD' (Monday of week 1), weeks }
// accessToken is the student's Google OAuth token with the calendar.events scope (from Firebase sign-in).
router.post('/export', async (req, res) => {
  const { accessToken, sectionIds = [], termStart, weeks = 13 } = req.body
  if (!accessToken) throw httpError(400, 'accessToken with the calendar.events scope is required')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(termStart ?? '')) throw httpError(400, 'termStart must be YYYY-MM-DD')

  const sections = await Section.find({ sectionId: { $in: sectionIds } })
  const created = []
  for (const s of sections) {
    const { start, end } = SLOTS[s.slot]
    const response = await fetch(GOOGLE_EVENTS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: `${s.module} ${s.section}`,
        location: s.venue,
        description: s.prof ? `Instructor: ${s.prof}` : undefined,
        start: { dateTime: isoLocal(termStart, s.day, start), timeZone: TIMEZONE },
        end: { dateTime: isoLocal(termStart, s.day, end), timeZone: TIMEZONE },
        recurrence: [`RRULE:FREQ=WEEKLY;COUNT=${weeks}`],
      }),
    })
    if (!response.ok) throw httpError(502, `Google Calendar rejected ${s.sectionId} (${response.status})`)
    created.push((await response.json()).id)
  }
  res.status(201).json({ created: created.length, eventIds: created })
})

export default router
