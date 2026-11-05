import { httpError } from '../../middleware/errorHandler.js';
import { revisionFilter } from './changes.js';

const fields = [
  'title',
  'cu',
  'schoolId',
  'department',
  'description',
  'categories',
  'fulfils',
  'prerequisites',
  'corequisites',
  'mutuallyExclusive',
  'prerequisiteRules',
  'requisiteNotes',
  'termsOffered',
];
const fail = (message) => {
  throw httpError(400, message);
};
export function moduleCode(value) {
  if (typeof value !== 'string' || !/^[A-Z][A-Z0-9._-]{1,39}$/.test(value))
    fail('Use an uppercase module code, for example IS216');
  return value;
}
function text(value, name, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`Invalid ${name}`);
  return value.trim();
}
function strings(value, name, max = 100, length = 100) {
  if (!Array.isArray(value) || value.length > max) fail(`Invalid ${name}`);
  const result = value.map((v) => text(v, name, length, true));
  if (new Set(result).size !== result.length) fail(`Duplicate values in ${name}`);
  return result;
}
export function validateModuleInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Module details are required');
  if (Object.keys(input).some((key) => !fields.includes(key) && key !== 'revision'))
    fail('Unknown module field');
  const out = { title: text(input.title, 'title', 300, true), cu: input.cu };
  if (typeof out.cu !== 'number' || !Number.isFinite(out.cu) || out.cu < 0 || out.cu > 10)
    fail('Credit units must be between 0 and 10');
  out.schoolId =
    input.schoolId == null || input.schoolId === '' ? null : text(input.schoolId, 'school', 60, true);
  out.department = text(input.department ?? '', 'department', 100);
  out.description = text(input.description ?? '', 'description', 20000);
  for (const key of ['categories', 'fulfils', 'mutuallyExclusive', 'requisiteNotes', 'termsOffered'])
    out[key] = strings(input[key] ?? [], key, 100, key === 'requisiteNotes' ? 2000 : 100);
  out.mutuallyExclusive.forEach(moduleCode);
  if (out.termsOffered.some((t) => !['T1', 'T2', 'T3'].includes(t)))
    fail('Terms offered must be T1, T2 or T3');
  for (const key of ['prerequisites', 'corequisites']) {
    const groups = input[key] ?? [];
    if (!Array.isArray(groups) || groups.length > 50) fail(`Invalid ${key}`);
    out[key] = groups.map((group) => {
      const codes = strings(group, key, 50, 40);
      if (!codes.length) fail(`Empty ${key} group`);
      codes.forEach(moduleCode);
      return codes;
    });
  }
  const rules = input.prerequisiteRules ?? [];
  if (!Array.isArray(rules) || rules.length > 20) fail('Invalid prerequisite rules');
  out.prerequisiteRules = rules.map((rule) => {
    if (
      !rule ||
      Object.keys(rule).some((k) => !['countFrom', 'n'].includes(k)) ||
      rule.countFrom !== 'TRACK' ||
      !Number.isInteger(rule.n) ||
      rule.n < 1 ||
      rule.n > 100
    )
      fail('Invalid prerequisite rule');
    return { countFrom: rule.countFrom, n: rule.n };
  });
  return out;
}
export function moduleSnapshot(row) {
  return Object.fromEntries(
    ['_id', ...fields, 'revision', 'archived']
      .filter((key) => row[key] !== undefined)
      .map((key) => [key, row[key]]),
  );
}
export function createModuleEditor({ change, read, knownCodes, schoolExists, insert, replace }) {
  return {
    async save(actor, code, input, creating = false) {
      if (actor?.role !== 'admin') throw httpError(403, 'Admins only');
      moduleCode(code);
      const data = validateModuleInput(input);
      if (!creating) revisionFilter(code, input.revision);
      else if (input.revision !== undefined) fail('New modules must not include a revision');
      const result = await change(
        { actor, action: creating ? 'create' : 'update', entity: 'module', entityId: code },
        async (session) => {
          const before = await read(code, session);
          if (creating && before) throw httpError(409, 'Module code already exists');
          if (!creating && !before) throw httpError(404, 'Module not found');
          if (!creating && (before.revision ?? 0) !== input.revision)
            throw httpError(409, 'Module changed. Reload before saving.');
          const refs = [
            ...new Set([
              ...data.prerequisites.flat(),
              ...data.corequisites.flat(),
              ...data.mutuallyExclusive,
            ]),
          ];
          if (refs.includes(code)) fail('A module cannot reference itself');
          const known = new Set(await knownCodes(refs, session));
          const missing = refs.filter((ref) => !known.has(ref));
          if (missing.length) fail(`Unknown module codes: ${missing.join(', ')}`);
          if (data.schoolId && !(await schoolExists(data.schoolId, session))) fail('Unknown school');
          const after = creating
            ? await insert({ _id: code, ...data, revision: 0 }, session)
            : await replace(code, input.revision, data, session);
          if (!after) throw httpError(409, 'Module changed. Reload before saving.');
          return { before: before ? moduleSnapshot(before) : null, after: moduleSnapshot(after) };
        },
      );
      return result.after;
    },
  };
}
