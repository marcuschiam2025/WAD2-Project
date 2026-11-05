// Builds data/sections.json (the Section collection that `pnpm seed` loads) from the BOSS class
// timetable export: one row per class meeting per instructor, saved from BOSS as .xls (an HTML table).
// Each section gets one entry with its weekly meetings and instructors.
// Sections of courses missing from data/modules.json are left out, so run `pnpm build-catalogue` first.
// Usage: pnpm build-sections <timetable.xls> [more terms' files…]
import { readFileSync, writeFileSync } from 'node:fs';
import { parseHtmlTable } from './utils/parseHtmlTable.js';

const filePaths = process.argv.slice(2);
if (filePaths.length === 0) {
  console.error("Usage: pnpm build-sections <timetable.xls> [more terms' files…]");
  process.exit(1);
}

const OUTPUT_FILE = new URL('../data/sections.json', import.meta.url);
const MODULES_FILE = new URL('../data/modules.json', import.meta.url);

// A section can only belong to a module in our catalogue
const catalogue = new Set();
for (const module of JSON.parse(readFileSync(MODULES_FILE, 'utf8'))) {
  catalogue.add(module._id);
}

// Courses the planner leaves out (none at the moment)
const EXCLUDED_COURSES = [];

const DAYS = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

// "2026-27 Term 2 / 1A" → { term: "AY26/27 T2", session: "1A" }
function toTermAndSession(text) {
  const match = text.match(/^20(\d\d)-(\d\d) Term (\d) \/ (\w+)$/);
  if (!match) return null;
  return { term: `AY${match[1]}/${match[2]} T${match[3]}`, session: match[4] };
}

// "11/01/2027" → "2027-01-11", or null when blank
function toIsoDate(text) {
  const match = text.match(/^(\d\d)\/(\d\d)\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

// ---------------------------------------------------------------------------------------------
// Read every file into sections, keyed by term + section id
// ---------------------------------------------------------------------------------------------

const sections = new Map();
// Courses with sections but no catalogue entry: course code → title
const notInCatalogue = new Map();

for (const filePath of filePaths) {
  const [header, ...rows] = parseHtmlTable(readFileSync(filePath, 'utf8'));
  const col = {};
  header.forEach((name, i) => (col[name] = i));

  let kept = 0;
  for (const row of rows) {
    if (row.length < header.length) continue; // blank line

    const termAndSession = toTermAndSession(row[col['Term / Session']]);
    const module = row[col['Course Code']];
    if (!termAndSession || !module || EXCLUDED_COURSES.includes(module)) continue;
    if (!catalogue.has(module)) {
      notInCatalogue.set(module, row[col['Title']]);
      continue;
    }

    const sectionId = `${module}-${row[col['Section']]}`;
    const key = `${termAndSession.term}|${sectionId}`;

    // The first row of a section creates it; later rows add meetings and instructors
    if (!sections.has(key)) {
      sections.set(key, {
        sectionId,
        module,
        section: row[col['Section']],
        term: termAndSession.term,
        session: termAndSession.session,
        title: row[col['Title']],
        topic: row[col['Topic']] || null,
        classNumber: row[col['Class']] || null,
        instructors: [],
        meetings: [],
        startDate: toIsoDate(row[col['Start Date']]),
        endDate: toIsoDate(row[col['End Date']]),
      });
    }
    const section = sections.get(key);

    // One row per instructor, so the same name or meeting can appear more than once
    const instructor = row[col['Instructor']];
    if (instructor && !section.instructors.includes(instructor)) {
      section.instructors.push(instructor);
    }

    // Work-study electives and SMU-X projects have no day or time: they get no meetings
    const day = DAYS[row[col['Day']]];
    const start = row[col['Start']];
    const end = row[col['End']];
    if (day !== undefined && start && end) {
      const meeting = { day, start, end, venue: row[col['Venue']] || null };
      let alreadyListed = false;
      for (const existing of section.meetings) {
        if (
          existing.day === day &&
          existing.start === start &&
          existing.end === end &&
          existing.venue === meeting.venue
        ) {
          alreadyListed = true;
        }
      }
      if (!alreadyListed) section.meetings.push(meeting);
    }
    kept++;
  }
  console.log(`${filePath}: ${kept} of ${rows.length} rows kept`);
}

// ---------------------------------------------------------------------------------------------
// Write the sections, meetings in weekly order
// ---------------------------------------------------------------------------------------------

const output = [...sections.values()];
for (const section of output) {
  section.meetings.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
}
output.sort(
  (a, b) => a.term.localeCompare(b.term) || a.sectionId.localeCompare(b.sectionId, 'en', { numeric: true }),
);

writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n');

let withoutMeetings = 0;
for (const section of output) {
  if (section.meetings.length === 0) withoutMeetings++;
}
const modules = new Set(output.map((section) => section.module));
console.log(
  `sections.json: ${output.length} sections for ${modules.size} modules (${withoutMeetings} without a timetable)`,
);

if (notInCatalogue.size > 0) {
  console.log(`Left out ${notInCatalogue.size} courses that are not in the catalogue:`);
  for (const [code, title] of notInCatalogue) {
    console.log(`  ${code}  ${title}`);
  }
}
