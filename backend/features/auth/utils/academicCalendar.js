// When each semester ends: midnight Singapore time after the last day of its exams, stored in UTC.
// From SMU's Academic Calendars for Undergraduate/Juris Doctor Programmes (AY2026-27, AY2027-28).
// Add each new academic year here when SMU publishes it.
export const SEMESTER_ENDS = [
  '2026-12-06T16:00:00Z', // AY26/27 Term 1, exams end Sun 6 Dec 2026
  '2027-05-02T16:00:00Z', // AY26/27 Term 2, exams end Sun 2 May 2027
  '2027-12-05T16:00:00Z', // AY27/28 Term 1, exams end Sun 5 Dec 2027
  '2028-04-30T16:00:00Z', // AY27/28 Term 2, exams end Sun 30 Apr 2028
];

// How many semesters have ended since this student's current semester was last set
export function semestersDue(user, now = new Date(), ends = SEMESTER_ENDS) {
  if (!user.onboarded || !user.currentSem) return 0;
  const since = new Date(user.semesterCheckedAt ?? user.createdAt ?? now);
  return ends.filter((end) => new Date(end) > since && new Date(end) <= now).length;
}
