import { httpError } from '../../middleware/errorHandler.js'
import { revisionFilter } from './changes.js'
import { moduleCode } from './modules.service.js'
const fail = message => { throw httpError(400, message) }
const ruleFields = {
  all: ['modules'], chooseN: ['modules', 'n'], basket: ['tag'], anyFromCategory: ['categories'], flag: ['tag', 'autoFulfilled'],
}
const common = ['label', 'heading', 'order', 'countsToward', 'cuRequired']
function text(value, field, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`Invalid ${field}`)
  return value.trim()
}
function whitelist(input, fields) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !fields.includes(key) && key !== 'revision')) fail('Unknown or immutable curriculum field')
}
export function curriculumId(value) {
  if (typeof value !== 'string' || !/^[A-Z0-9][A-Z0-9_.-]{0,149}$/.test(value)) fail('Invalid curriculum record ID')
  return value
}
export function validateRequirementEdit(rule, input) {
  if (!ruleFields[rule]) fail('Unsupported requirement type')
  whitelist(input, [...common, ...ruleFields[rule]])
  const out = { label: text(input.label, 'label', 300, true), heading: text(input.heading ?? '', 'heading', 300), order: input.order, countsToward: input.countsToward, cuRequired: input.cuRequired }
  if (!Number.isSafeInteger(out.order) || out.order < 0 || out.order > 10000) fail('Order must be a non-negative whole number')
  if (!['UNI_CORE', 'MAJOR_CORE', 'MAJOR_ELECTIVES', 'FREE_ELECTIVES', 'NONE'].includes(out.countsToward)) fail('Choose a valid credit category')
  if (typeof out.cuRequired !== 'number' || !Number.isFinite(out.cuRequired) || out.cuRequired < 0 || out.cuRequired > 100 || (rule !== 'flag' && out.cuRequired === 0)) fail('Invalid required credit units')
  if (rule === 'flag' && out.cuRequired !== 0) fail('Non-credit requirements must have zero credit units')
  for (const key of ['modules', 'categories'].filter(key => ruleFields[rule].includes(key))) {
    const values = input[key]
    if (!Array.isArray(values) || !values.length || values.length > 1000 || values.some(value => typeof value !== 'string' || !value.trim() || value.length > 100)) fail(`Invalid ${key}`)
    out[key] = values.map(value => value.trim())
    if (new Set(out[key]).size !== out[key].length) fail(`Duplicate ${key}`)
    if (key === 'modules') out[key].forEach(moduleCode)
  }
  if (rule === 'chooseN') {
    if (!Number.isSafeInteger(input.n) || input.n < 1 || input.n > out.modules.length) fail('Course count must be between one and the number of listed modules')
    out.n = input.n
  }
  if (ruleFields[rule].includes('tag')) out.tag = text(input.tag, 'requirement tag', 100, true)
  if (rule === 'flag') {
    if (typeof input.autoFulfilled !== 'boolean') fail('Choose whether the non-credit requirement is automatically fulfilled')
    out.autoFulfilled = input.autoFulfilled
  }
  return out
}
export function validateTrackEdit(input) {
  whitelist(input, ['name', 'description', 'source', 'lastChecked'])
  const out = { name: text(input.name, 'track name', 300, true), description: text(input.description ?? '', 'description', 10000), source: text(input.source ?? '', 'source', 2000), lastChecked: null }
  if (out.source) { try { const url = new URL(out.source); if (!['https:', 'http:'].includes(url.protocol)) fail('Source must be an HTTP or HTTPS URL') } catch { fail('Source must be an HTTP or HTTPS URL') } }
  if (input.lastChecked) {
    if (typeof input.lastChecked !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(input.lastChecked)) fail('Invalid checked date')
    const date = new Date(`${input.lastChecked}T00:00:00Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.lastChecked) fail('Invalid checked date')
    out.lastChecked = date
  }
  return out
}
export function curriculumSnapshot(kind, row) {
  const keys = kind === 'track' ? ['_id', 'majorId', 'trackCode', 'name', 'description', 'source', 'lastChecked', 'revision'] : ['_id', 'ownerId', 'level', 'rule', ...common, 'modules', 'n', 'tag', 'categories', 'autoFulfilled', 'revision']
  return Object.fromEntries(keys.filter(key => row[key] !== undefined).map(key => [key, row[key]]))
}
export function createCurriculumEditor({ change, major, track, requirement, modules, update }) {
  return { async save(actor, majorId, kind, id, input) {
    if (actor?.role !== 'admin') throw httpError(403, 'Admins only')
    curriculumId(majorId); curriculumId(id)
    if (!['track', 'requirement'].includes(kind)) fail('Invalid curriculum record type')
    revisionFilter(id, input?.revision)
    const result = await change({ actor, action: 'update', entity: kind === 'track' ? 'track' : 'curriculum', entityId: id }, async session => {
      if (!await major(majorId, session)) throw httpError(404, 'Curriculum not found')
      const before = kind === 'track' ? await track(id, session) : await requirement(id, session)
      if (!before) throw httpError(404, 'Curriculum record not found')
      if (kind === 'track') {
        if (before.majorId !== majorId) throw httpError(404, 'Track does not belong to this curriculum')
      } else if (before.ownerId === majorId) {
        if (!['core', 'major'].includes(before.level)) throw httpError(404, 'Requirement does not belong to this curriculum')
      } else {
        const owner = await track(before.ownerId, session)
        if (before.level !== 'track' || owner?.majorId !== majorId) throw httpError(404, 'Requirement does not belong to this curriculum')
      }
      if (kind === 'requirement' && (before.level !== 'track' || !['all', 'chooseN'].includes(before.rule))) throw httpError(400, 'This requirement is read-only until its planner checklist is connected.')
      if ((before.revision ?? 0) !== input.revision) throw httpError(409, 'Curriculum record changed. Reload before saving.')
      const data = kind === 'track' ? validateTrackEdit(input) : validateRequirementEdit(before.rule, input)
      if (data.modules) {
        const found = new Map((await modules(data.modules, session)).map(row => [row._id, row]))
        const missing = data.modules.filter(code => !found.has(code))
        if (missing.length) fail(`Unknown module codes: ${missing.join(', ')}`)
        const archived = data.modules.filter(code => found.get(code)?.archived && !before.modules?.includes(code))
        if (archived.length) fail(`Restore archived modules before adding them: ${archived.join(', ')}`)
      }
      const after = await update(kind, before, data, session)
      if (!after) throw httpError(409, 'Curriculum record changed. Reload before saving.')
      return { before: curriculumSnapshot(kind, before), after: curriculumSnapshot(kind, after) }
    })
    return { ...result.after, revision: result.after.revision ?? 0 }
  } }
}
