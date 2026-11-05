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
const CODE = /^[A-Z][A-Z0-9._-]{1,39}$/;
export function moduleCode(value) {
  if (typeof value !== 'string' || !CODE.test(value)) fail('Use an uppercase module code, for example IS216');
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
// Says which field and value are wrong: the code being saved may be fine while a requisite isn't
function requisiteCode(value, field) {
  if (!CODE.test(value))
    fail(`${field}: "${value}" is not a module code. Separate codes with commas, for example IS111, CS101`);
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
  out.mutuallyExclusive.forEach((code) => requisiteCode(code, 'mutuallyExclusive'));
  if (out.termsOffered.some((t) => !['T1', 'T2', 'T3'].includes(t)))
    fail('Terms offered must be T1, T2 or T3');
  for (const key of ['prerequisites', 'corequisites']) {
    const groups = input[key] ?? [];
    if (!Array.isArray(groups) || groups.length > 50) fail(`Invalid ${key}`);
    out[key] = groups.map((group) => {
      const codes = strings(group, key, 50, 40);
      if (!codes.length) fail(`Empty ${key} group`);
      codes.forEach((code) => requisiteCode(code, key));
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
          // A course can only be in one of these lists. Only a new overlap is refused, so a saved record stays editable.
          const lists = (row) => ({
            prerequisite: new Set((row?.prerequisites ?? []).flat()),
            corequisite: new Set((row?.corequisites ?? []).flat()),
            'mutually exclusive module': new Set(row?.mutuallyExclusive ?? []),
          });
          const now = lists(data);
          const was = lists(before);
          for (const [first, second] of [
            ['prerequisite', 'corequisite'],
            ['prerequisite', 'mutually exclusive module'],
            ['corequisite', 'mutually exclusive module'],
          ]) {
            const overlap = [...now[first]].filter(
              (ref) => now[second].has(ref) && !(was[first].has(ref) && was[second].has(ref)),
            );
            if (overlap.length) fail(`${overlap.join(', ')} cannot be both a ${first} and a ${second}`);
          }
          const refs = [
            ...new Set([
              ...data.prerequisites.flat(),
              ...data.corequisites.flat(),
              ...data.mutuallyExclusive,
            ]),
          ];
          if (refs.includes(code)) fail('A module cannot reference itself');
          // Seeded requisites can name retired courses (STAT101, IS200). Those stay valid on the module that already
          // has them, or it could never be saved again; only a newly added code has to exist in the catalogue.
          const existing = new Set([
            ...(before?.prerequisites ?? []).flat(),
            ...(before?.corequisites ?? []).flat(),
            ...(before?.mutuallyExclusive ?? []),
          ]);
          const added = refs.filter((ref) => !existing.has(ref));
          const known = new Set(await knownCodes(added, session));
          const missing = added.filter((ref) => !known.has(ref));
          if (missing.length)
            fail(`These module codes are not in the catalogue: ${missing.join(', ')}. Add them first.`);
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
