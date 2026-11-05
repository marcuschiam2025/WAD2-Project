import { loadSections } from '../bidding/section.repository.js';
import { findClashes, findExamClashes } from '../bidding/utils/clash.js';
import { httpError } from '../../middleware/errorHandler.js';

const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const TIMEZONE = 'Asia/Singapore';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    DATE.test(value ?? '') && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function isoLocal(monday, day, time) {
  const date = new Date(monday);
  date.setUTCDate(date.getUTCDate() + day);
  return `${date.toISOString().slice(0, 10)}T${time}:00`;
}

// First class on or after the section's start date that falls on the meeting's weekday (0 = Monday)
function firstClassDate(startDate, day) {
  const date = new Date(`${startDate}T00:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() + ((day - weekday + 7) % 7));
  return date.toISOString().slice(0, 10);
}

// Sections from the catalogue carry their own teaching dates, e.g. 2027-01-11 to 2027-04-18
const hasDates = (section) =>
  isDate(section.startDate) && isDate(section.endDate) && section.startDate <= section.endDate;

// The Google event for one weekly meeting. Dated sections repeat until their end date (23:59:59 in
// Singapore, written in UTC as RRULE needs); others repeat `weeks` times from the termStart Monday.
function meetingEvent(section, meeting, monday, weeks) {
  let start, end, recurrence;
  if (hasDates(section)) {
    const first = firstClassDate(section.startDate, meeting.day);
    if (first > section.endDate) return null;
    start = `${first}T${meeting.start}:00`;
    end = `${first}T${meeting.end}:00`;
    recurrence = `RRULE:FREQ=WEEKLY;UNTIL=${section.endDate.replace(/-/g, '')}T155959Z`;
  } else {
    start = isoLocal(monday, meeting.day, meeting.start);
    end = isoLocal(monday, meeting.day, meeting.end);
    recurrence = `RRULE:FREQ=WEEKLY;COUNT=${weeks}`;
  }
  return {
    summary: `${section.module} ${section.section}`,
    location: meeting.venue,
    description: ['Added by BidMaxxer', section.prof && `Instructor: ${section.prof}`]
      .filter(Boolean)
      .join('\n'),
    start: { dateTime: start, timeZone: TIMEZONE },
    end: { dateTime: end, timeZone: TIMEZONE },
    recurrence: [recurrence],
  };
}

// Requires a separate Google OAuth access token with calendar.events permission.
// Firebase ID tokens used to sign into BidMaxxer cannot authorise this request.
// termStart (Monday of the first teaching week) and weeks are only needed for sections without dates.
export async function exportTimetable(req, res) {
  const { accessToken, sectionIds, termStart, weeks = 13 } = req.body;
  if (typeof accessToken !== 'string' || !accessToken.trim())
    throw httpError(400, 'accessToken with the calendar.events scope is required');
  if (
    !Array.isArray(sectionIds) ||
    !sectionIds.length ||
    sectionIds.length > 20 ||
    sectionIds.some((id) => typeof id !== 'string' || !id.trim())
  )
    throw httpError(400, 'Provide between 1 and 20 sectionIds');
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 20)
    throw httpError(400, 'weeks must be a whole number from 1 to 20');
  let monday = null;
  if (termStart !== undefined && termStart !== null && termStart !== '') {
    if (!isDate(termStart)) throw httpError(400, 'termStart must be a valid YYYY-MM-DD date');
    monday = new Date(`${termStart}T00:00:00Z`);
    if (monday.getUTCDay() !== 1)
      throw httpError(400, 'termStart must be the Monday of the first teaching week');
  }
  const ids = [...new Set(sectionIds)];
  const sections = await loadSections({ ids });
  if (sections.length !== ids.length) throw httpError(400, 'Some sections are no longer available');
  if (new Set(sections.map((s) => s.term)).size > 1)
    throw httpError(400, 'All sections must belong to one term');
  if (new Set(sections.map((s) => s.module)).size !== sections.length)
    throw httpError(400, 'Choose only one section per module');
  if (findClashes(sections).length || findExamClashes(sections).length)
    throw httpError(400, 'Resolve class and exam clashes before exporting');
  const undated = sections.filter((section) => !hasDates(section));
  if (undated.length && !monday)
    throw httpError(
      400,
      `No teaching dates for ${undated.map((s) => s.module).join(', ')}. Send termStart, the Monday of the first teaching week.`,
    );

  const events = [];
  for (const section of sections) {
    for (const meeting of section.sessions) {
      const event = meetingEvent(section, meeting, monday, weeks);
      if (event) events.push({ sectionId: section.sectionId, event });
    }
  }
  if (!events.length) throw httpError(400, 'These sections have no fixed class times to add');

  const created = [];
  for (const { sectionId, event } of events) {
    const response = await fetch(GOOGLE_EVENTS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      // Nothing was added yet and Google refused the token: the student didn't grant calendar access
      if (!created.length && (response.status === 401 || response.status === 403))
        throw httpError(
          403,
          'Google Calendar access was not granted. Try again and allow BidMaxxer to add events to your calendar.',
        );
      throw httpError(
        502,
        `Google Calendar rejected ${sectionId} (${response.status}). ${created.length} meeting series were already created; check your calendar before retrying.`,
      );
    }
    created.push((await response.json()).id);
  }
  res.status(201).json({ created: created.length, eventIds: created });
}
