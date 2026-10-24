import Section from '../bidding/models/Section.js'
import Module from '../planning/models/Module.js'
import { canonicalTerm, termLabel } from '../bidding/utils/sectionData.js'
import { httpError } from '../../middleware/errorHandler.js'
import { revisionFilter } from './changes.js'
import { auditedChange } from './audit.service.js'
import { createSectionEditor, sectionEditorView, sectionIdentity } from './sections.service.js'
import { moduleCode } from './modules.service.js'

function identityFilter({ termKey, moduleCode, sectionCode }) {
  return { $or: [{ termKey, moduleCode, sectionCode }, { term: { $in: [termKey, termLabel(termKey)] }, module: moduleCode, section: sectionCode }] }
}
async function read(identity, session) {
  const rows = await Section.collection.find(identityFilter(identity), { session }).limit(2).toArray()
  if (rows.length > 1) throw httpError(409, 'Duplicate catalogue section identities need resolving before editing')
  return rows[0] ?? null
}
const editor = createSectionEditor({
  change: auditedChange, read,
  activeModule: (code, session) => Module.exists({ _id: code, archived: { $ne: true } }).session(session),
  insert: async (data, session) => { await Section.collection.insertOne(data, { session }); return data },
  update: (before, data, session) => Section.collection.findOneAndUpdate(revisionFilter(before._id, before.revision ?? 0), { $set: data, $inc: { revision: 1 } }, { session, returnDocument: 'after', includeResultMetadata: false }),
})
export async function listAdminSections(req, res) {
  const code = moduleCode(req.query.module)
  let termKey
  try { termKey = canonicalTerm(req.query.term) } catch { throw httpError(400, 'Choose a valid academic term') }
  const rows = await Section.collection.find({ $or: [{ moduleCode: code, termKey }, { module: code, term: { $in: [termKey, termLabel(termKey)] } }] }).limit(201).toArray()
  if (rows.length > 200) throw httpError(409, 'Too many sections for this module and term')
  res.json(rows.map(sectionEditorView).sort((a, b) => a.sectionCode.localeCompare(b.sectionCode)))
}
export async function createAdminSection(req, res) { res.status(201).json(await editor.save(req.user, req.body, true)) }
export async function updateAdminSection(req, res) {
  const path = sectionIdentity({ termKey: req.params.term, moduleCode: req.params.code, sectionCode: req.params.section })
  if (Object.keys(path).some(key => req.body?.[key] !== path[key])) throw httpError(400, 'Module, term and section code cannot change after creation')
  res.json(await editor.save(req.user, req.body))
}
