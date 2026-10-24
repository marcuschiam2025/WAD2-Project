import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  actorId: { type: String, required: true, immutable: true },
  actorName: { type: String, required: true, immutable: true },
  action: { type: String, enum: ['create', 'update', 'archive', 'delete', 'grant-admin'], required: true, immutable: true },
  entity: { type: String, required: true, immutable: true },
  entityId: { type: String, required: true, immutable: true },
  before: { type: mongoose.Schema.Types.Mixed, immutable: true },
  after: { type: mongoose.Schema.Types.Mixed, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export default mongoose.model('AuditEntry', schema)
