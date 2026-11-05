import mongoose from 'mongoose';
import Module from '../planning/models/Module.js';
import { auditedChange } from './audit.service.js';
import { revisionFilter } from './changes.js';
import { createModuleEditor, moduleCode } from './modules.service.js';
import AuditEntry from './models/AuditEntry.js';
import { createModuleLifecycle, moduleReferenceQueries } from './module-lifecycle.js';
import { httpError } from '../../middleware/errorHandler.js';

const editor = createModuleEditor({
  change: auditedChange,
  read: (code, session) => Module.findById(code).session(session).lean(),
  knownCodes: async (codes, session) =>
    (
      await Module.find({ _id: { $in: codes } })
        .select('_id')
        .session(session)
        .lean()
    ).map((m) => m._id),
  schoolExists: (code, session) =>
    mongoose.connection.db.collection('schools').findOne({ _id: code }, { session }),
  insert: async (data, session) => (await Module.create([data], { session }))[0].toObject(),
  replace: (code, revision, data, session) =>
    Module.findOneAndUpdate(
      revisionFilter(code, revision),
      { $set: data, $inc: { revision: 1 } },
      { new: true, runValidators: true, session },
    ).lean(),
});
// Everything the module form's dropdowns choose from
export async function getAdminModuleOptions(_req, res) {
  const { db } = mongoose.connection;
  const requirements = db.collection('requirements');
  const [modules, schools, departments, categories, fulfils, requiredCategories, requiredTags] =
    await Promise.all([
      Module.find().select('_id title archived').sort({ _id: 1 }).lean(),
      db
        .collection('schools')
        .find({}, { projection: { name: 1 } })
        .sort({ _id: 1 })
        .toArray(),
      Module.distinct('department'),
      Module.distinct('categories'),
      Module.distinct('fulfils'),
      requirements.distinct('categories'),
      requirements.distinct('tag'),
    ]);
  // Values a requirement looks for count too, even if no module has them yet. ANY means "any course", not a real category.
  const sorted = (...lists) => [...new Set(lists.flat().filter(Boolean))].sort();
  res.json({
    modules,
    schools,
    departments: sorted(departments),
    categories: sorted(categories, requiredCategories).filter((category) => category !== 'ANY'),
    fulfils: sorted(fulfils, requiredTags),
  });
}
export async function listAdminModules(req, res) {
  const q = req.query.q ?? '';
  if (typeof q !== 'string' || q.length > 100) throw httpError(400, 'Invalid search');
  const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const filter = q ? { $or: [{ _id: pattern }, { title: pattern }] } : {};
  if (req.query.after !== undefined) filter._id = { $gt: moduleCode(req.query.after) };
  const rows = await Module.find(filter)
    .select('_id title cu revision archived')
    .sort({ _id: 1 })
    .limit(51)
    .lean();
  const items = rows.slice(0, 50);
  res.json({ items, next: rows.length > 50 ? items.at(-1)._id : null });
}
export async function getAdminModule(req, res) {
  const row = await Module.findById(moduleCode(req.params.code)).lean();
  if (!row) throw httpError(404, 'Module not found');
  res.json({ ...row, revision: row.revision ?? 0 });
}
export async function createAdminModule(req, res) {
  const { code, ...data } = req.body ?? {};
  res.status(201).json(await editor.save(req.user, code, data, true));
}
export async function updateAdminModule(req, res) {
  res.json(await editor.save(req.user, req.params.code, req.body));
}

const lifecycle = createModuleLifecycle({
  change: auditedChange,
  read: (code, session) => Module.findById(code).session(session).lean(),
  createdByStaff: (code, session) =>
    AuditEntry.exists({ entity: 'module', entityId: code, action: 'create' }).session(session),
  dependencies: async (code, session) => {
    const found = [];
    // Sequential operations: MongoDB transactions do not support parallel queries.
    for (const [label, collection, filter] of moduleReferenceQueries(code)) {
      if (
        await mongoose.connection.db
          .collection(collection)
          .findOne(filter, { session, projection: { _id: 1 }, maxTimeMS: 5000 })
      )
        found.push(label);
    }
    return found;
  },
  write: (code, revision, data, session) =>
    Module.findOneAndUpdate(
      revisionFilter(code, revision),
      { $set: data, $inc: { revision: 1 } },
      { new: true, session },
    ).lean(),
  remove: async (code, revision, session) =>
    (await Module.deleteOne(revisionFilter(code, revision), { session })).deletedCount === 1,
});
export async function archiveAdminModule(req, res) {
  res.json(await lifecycle.apply(req.user, req.params.code, req.body, 'archive'));
}
export async function restoreAdminModule(req, res) {
  res.json(await lifecycle.apply(req.user, req.params.code, req.body, 'restore'));
}
export async function deleteAdminModule(req, res) {
  await lifecycle.apply(req.user, req.params.code, req.body, 'delete');
  res.status(204).end();
}
