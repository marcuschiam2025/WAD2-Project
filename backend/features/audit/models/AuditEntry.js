import mongoose from 'mongoose'

// One admin change to the catalogue: who did what to which record, and the record before and after.
// Written by recordAudit() in audit.service.js; never edited or deleted through the API.
const auditEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    email: String, // copied in, so the log still reads well if the user is deleted
    action: { type: String, enum: ['create', 'update', 'delete'], required: true },
    collectionName: { type: String, required: true }, // e.g. modules, sections
    recordId: { type: String, required: true, index: true }, // e.g. IS213, or "AY26/27 T2 IS213-G1"
    changes: [String], // fields an update changed, e.g. ['title', 'cu']
    before: mongoose.Schema.Types.Mixed, // null for a create
    after: mongoose.Schema.Types.Mixed, // null for a delete
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

auditEntrySchema.index({ createdAt: -1 })

export default mongoose.model('AuditEntry', auditEntrySchema)
