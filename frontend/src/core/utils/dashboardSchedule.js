import { sectionMeetings } from './clash';
import { hasTeachingDates } from './ics';

const DAY = 86_400_000;
const timeValid = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? '');
// A UTC midnight representing the Singapore calendar day, independent of the browser's timezone.
export const singaporeDay = (date) =>
  new Date(`${date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Singapore' })}T00:00:00Z`);

export function plannedMeetings(sections, now) {
  const today = singaporeDay(now);
  const time = now.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return sections.filter(hasTeachingDates).flatMap((section) => {
    const meetings = sectionMeetings(section);
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(today.getTime() + offset * DAY);
      const key = date.toISOString().slice(0, 10);
      if (key < section.startDate || key > section.endDate) return [];
      const day = (date.getUTCDay() + 6) % 7;
      return meetings
        .filter(
          (m) =>
            m.day === day &&
            timeValid(m.start) &&
            timeValid(m.end) &&
            m.start < m.end &&
            (offset > 0 || m.end > time),
        )
        .map((m, index) => ({
          id: `planned-${section.id}-${key}-${m.start}-${index}`,
          kind: 'Planned class',
          module: section.module,
          meta: `${section.section} · ${m.venue || section.venueShort || 'Venue unconfirmed'}, to ${m.end}`,
          offset,
          time: m.start,
        }));
    }).flat();
  });
}
