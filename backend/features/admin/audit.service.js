import mongoose from 'mongoose'
import AuditEntry from './models/AuditEntry.js'
import { createAuditedChange } from './changes.js'

export const auditedChange = createAuditedChange({
  transaction: callback => mongoose.connection.transaction(callback),
  writeAudit: (entry, session) => AuditEntry.create([entry], { session }),
})
