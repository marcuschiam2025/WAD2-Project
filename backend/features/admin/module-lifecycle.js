import { httpError } from '../../middleware/errorHandler.js'
import { revisionFilter } from './changes.js'
import { moduleCode, moduleSnapshot } from './modules.service.js'

export function createModuleLifecycle({ change, read, dependencies, createdByStaff, write, remove }) {
  return { async apply(actor, code, input, action) {
    if (actor?.role !== 'admin') throw httpError(403, 'Admins only')
    moduleCode(code)
    if (!['archive', 'restore', 'delete'].includes(action)) throw httpError(400, 'Invalid module action')
    if (!input || Object.keys(input).some(key => key !== 'revision')) throw httpError(400, 'Only the displayed revision is accepted')
    revisionFilter(code, input.revision)
    const result = await change({ actor, action: action === 'restore' ? 'update' : action, entity: 'module', entityId: code }, async session => {
      const before = await read(code, session)
      if (!before) throw httpError(404, 'Module not found')
      if ((before.revision ?? 0) !== input.revision) throw httpError(409, 'Module changed. Reload before continuing.')
      if (action === 'delete') {
        if (!before.archived) throw httpError(409, 'Archive the module before permanently deleting it')
        // Original catalogue rows may also be referenced by historical imports or
        // external seed files. Keep them readable, even when no live use is found.
        if (!await createdByStaff(code, session)) throw httpError(409, 'Original seeded modules can only be archived')
        const refs = await dependencies(code, session)
        if (refs.length) throw httpError(409, `Module is referenced by: ${refs.join(', ')}. Keep it archived.`)
        if (!await remove(code, input.revision, session)) throw httpError(409, 'Module changed. Reload before continuing.')
        return { before: moduleSnapshot(before), after: null }
      }
      const after = await write(code, input.revision, { archived: action === 'archive' }, session)
      if (!after) throw httpError(409, 'Module changed. Reload before continuing.')
      return { before: moduleSnapshot(before), after: moduleSnapshot(after) }
    })
    return result.after
  } }
}

// Never return individual student records. Queries run in the mutation's session.
export function moduleReferenceQueries(code) {
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const mapping = new RegExp(`(^|\\s*→\\s*)${escaped}($|\\s*→\\s*)`)
  return [
    ['Other module requisites', 'modules', { _id: { $ne: code }, $or: [{ prerequisites: { $elemMatch: { $elemMatch: { $eq: code } } } }, { corequisites: { $elemMatch: { $elemMatch: { $eq: code } } } }, { mutuallyExclusive: code }] }],
    ['Curriculum requirements', 'requirements', { modules: code }],
    ['Class sections', 'sections', { $or: [{ module: code }, { moduleCode: code }] }],
    ['Degree plans', 'degreePlans', { 'semesters.modules': mapping }],
    ['Bidding carts', 'bidcarts', { 'items.module': code }],
    ['Bid history', 'bidhistories', { module: code }],
    ['Collaboration rooms', 'parties', { $or: [{ module: code }, { 'comments.module': code }] }],
    ['Student profiles and baskets', 'users', { $or: ['basket', 'completedModules', 'exempted'].map(key => ({ [key]: code })).concat([
      { $expr: { $in: [code, { $reduce: { input: { $objectToArray: { $ifNull: ['$takenBySem', {}] } }, initialValue: [], in: { $concatArrays: ['$$value', '$$this.v'] } } }] } },
    ]) }],
    ['Quiz result recommendations', 'quizattempts', { $or: [{ 'resultSnapshot.modules.code': code }, { 'resultSnapshot.recommendations.code': code }] }],
  ]
}
