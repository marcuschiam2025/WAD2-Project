import { httpError } from '../../middleware/errorHandler.js';
import {
  canonicalTerm,
  normalizeSection,
  termLabel,
  INSTRUCTOR_SEPARATOR,
} from '../bidding/utils/sectionData.js';
import { moduleCode } from './modules.service.js';
import { revisionFilter } from './changes.js';
const fail = (message) => {
  throw httpError(400, message);
};
const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const fields = [
  'moduleCode',
  'termKey',
  'sectionCode',
  'instructor',
  'capacity',
  'classSlots',
  'finalExam',
  'revision',
];
function text(value, label, max = 200) {
  if (typeof value !== 'string' || value.length > max) fail(`Invalid ${label}`);
  return value.trim();
}
function period(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.start ?? '') ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.end ?? '') ||
    value.start >= value.end
  )
    fail('Start and end must be valid times, with end after start');
  return { start: value.start, end: value.end, venue: text(value.venue ?? '', 'venue') };
}
export function sectionIdentity(input) {
  moduleCode(input.moduleCode);
  let termKey;
  try {
    termKey = canonicalTerm(input.termKey);
  } catch {
    fail('Invalid academic term. Use e.g. 2026-27_T2');
  }
  if (typeof input.sectionCode !== 'string' || !/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(input.sectionCode))
    fail('Invalid section code');
  return { moduleCode: input.moduleCode, termKey, sectionCode: input.sectionCode };
}
export function validateSectionInput(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !fields.includes(key))
  )
    fail('Invalid section fields');
  if (input.revision !== undefined) revisionFilter('unused', input.revision);
  const identity = sectionIdentity(input);
  const capacity = input.capacity ?? null;
  if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 10000))
    fail('Capacity must be a positive whole number, or blank if unknown');
  // 0 is allowed: work-study electives and SMU-X projects have no fixed class time
  if (!Array.isArray(input.classSlots) || input.classSlots.length > 14) fail('Add up to 14 weekly meetings');
  const classSlots = input.classSlots.map((slot) => {
    if (
      !slot ||
      Object.keys(slot).some((key) => !['day', 'start', 'end', 'venue'].includes(key)) ||
      !days.includes(slot.day)
    )
      fail('Invalid weekly meeting');
    return { day: slot.day, ...period(slot) };
  });
  for (let i = 0; i < classSlots.length; i++)
    for (let j = i + 1; j < classSlots.length; j++) {
      const a = classSlots[i],
        b = classSlots[j];
      if (a.day === b.day && a.start < b.end && b.start < a.end)
        fail('Weekly meetings for the same section cannot overlap');
    }
  let finalExam = null;
  if (input.finalExam != null) {
    const exam = input.finalExam;
    if (
      typeof exam !== 'object' ||
      Object.keys(exam).some((key) => !['date', 'start', 'end', 'venue'].includes(key))
    )
      fail('Invalid exam fields');
    if (typeof exam.date !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(exam.date)) fail('Invalid exam date');
    const date = new Date(`${exam.date}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== exam.date)
      fail('Invalid exam date');
    finalExam = { date: new Date(`${exam.date}T00:00:00+08:00`), ...period(exam) };
  }
  return {
    ...identity,
    instructor: text(input.instructor ?? '', 'instructor'),
    capacity,
    classSlots,
    finalExam,
  };
}
// The editor's input in the stored catalogue format (see scripts/build-sections.js and models/Section.js).
// Fields the editor doesn't show (title, topic, session, dates) are left as they are on update.
export function toStoredSection(data) {
  const instructors = data.instructor
    .split(INSTRUCTOR_SEPARATOR.trim())
    .map((name) => name.trim())
    .filter(Boolean);
  return {
    sectionId: `${data.moduleCode}-${data.sectionCode}`,
    module: data.moduleCode,
    section: data.sectionCode,
    term: termLabel(data.termKey),
    instructors,
    capacity: data.capacity,
    meetings: data.classSlots.map((slot) => ({
      day: days.indexOf(slot.day),
      start: slot.start,
      end: slot.end,
      venue: slot.venue || null,
    })),
    finalExam: data.finalExam,
    examSource: 'admin', // pnpm import-exams never overwrites an exam staff entered
  };
}
export function sectionSnapshot(raw) {
  return Object.fromEntries(
    [
      '_id',
      'moduleCode',
      'termKey',
      'sectionCode',
      'instructor',
      'instructors',
      'capacity',
      'classSlots',
      'meetings',
      'finalExam',
      'sectionId',
      'module',
      'term',
      'section',
      'day',
      'slot',
      'prof',
      'venue',
      'exam',
      'revision',
      'archived',
    ]
      .filter((key) => raw[key] !== undefined)
      .map((key) => [key, raw[key]]),
  );
}
export function sectionEditorView(raw) {
  const normalized = normalizeSection(raw);
  return {
    moduleCode: normalized.module,
    termKey: normalized.term,
    sectionCode: normalized.section,
    sectionId: normalized.sectionId,
    archived: raw.archived === true,
    revision: raw.revision ?? 0,
    instructor: normalized.prof ?? '',
    capacity: raw.capacity ?? null,
    classSlots: normalized.sessions.map(({ day, start, end, venue }) => ({
      day: days[day],
      start,
      end,
      venue: venue ?? '',
    })),
    finalExam: normalized.examPeriod ? { ...normalized.examPeriod, venue: raw.finalExam?.venue ?? '' } : null,
    legacyExamNote: !raw.moduleCode && raw.exam && raw.exam !== 'No final exam' ? raw.exam : null,
  };
}
export function createSectionEditor({ change, read, activeModule, insert, update }) {
  return {
    async save(actor, input, creating = false) {
      if (actor?.role !== 'admin') throw httpError(403, 'Admins only');
      const data = validateSectionInput(input);
      if (!creating) revisionFilter('unused', input.revision);
      else if (input.revision !== undefined) fail('New sections must not include a revision');
      const id = `${data.termKey}:${data.moduleCode}:${data.sectionCode}`;
      const result = await change(
        { actor, entity: 'section', entityId: id, action: creating ? 'create' : 'update' },
        async (session) => {
          const before = await read(data, session);
          if (creating && before) throw httpError(409, 'This section already exists in the selected term');
          if (!creating && !before) throw httpError(404, 'Section not found');
          if (!creating && (before.revision ?? 0) !== input.revision)
            throw httpError(409, 'Section changed. Reload before saving.');
          if (creating && !(await activeModule(data.moduleCode, session)))
            fail('Choose an active module from the catalogue');
          if (
            before &&
            !before.moduleCode &&
            before.exam &&
            before.exam !== 'No final exam' &&
            !data.finalExam
          )
            fail(
              'This legacy section has an exam note. Enter its structured exam date and times before saving.',
            );
          const stored = toStoredSection(data);
          const after = creating
            ? await insert({ ...stored, archived: false, revision: 0 }, session)
            : await update(before, stored, session);
          if (!after) throw httpError(409, 'Section changed. Reload before saving.');
          return { before: before ? sectionSnapshot(before) : null, after: sectionSnapshot(after) };
        },
      );
      return sectionEditorView(result.after);
    },
  };
}

export function createSectionLifecycle({ change, read, activeModule, update }) {
  return {
    async apply(actor, identity, input, archived) {
      if (actor?.role !== 'admin') throw httpError(403, 'Admins only');
      const key = sectionIdentity(identity);
      if (!input || Object.keys(input).some((field) => field !== 'revision'))
        fail('Only the displayed revision is accepted');
      revisionFilter('unused', input.revision);
      const result = await change(
        {
          actor,
          entity: 'section',
          entityId: `${key.termKey}:${key.moduleCode}:${key.sectionCode}`,
          action: archived ? 'archive' : 'update',
        },
        async (session) => {
          const before = await read(key, session);
          if (!before) throw httpError(404, 'Section not found');
          if ((before.revision ?? 0) !== input.revision)
            throw httpError(409, 'Section changed. Reload before continuing.');
          if (!archived && !(await activeModule(key.moduleCode, session)))
            fail('Restore the active module before restoring its section');
          const after = await update(before, { archived }, session);
          if (!after) throw httpError(409, 'Section changed. Reload before continuing.');
          return { before: sectionSnapshot(before), after: sectionSnapshot(after) };
        },
      );
      return sectionEditorView(result.after);
    },
  };
}
