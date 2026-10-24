import test from 'node:test'
import assert from 'node:assert/strict'
import { repairLegacyPlanIndex } from './legacy-plan-index.js'
const legacy = { name: 'userId_1_slot_1', key: { userId: 1, slot: 1 }, unique: true }
function collection(index = legacy, legacyCount = 0) {
 const dropped = []
 return { dropped, indexes: async () => [{ name: '_id_', key: { _id: 1 } }, ...(index ? [index] : [])], countDocuments: async () => legacyCount, dropIndex: async name => dropped.push(name) }
}
test('dry run identifies the obsolete unique index without changing it', async () => {
 const db = collection()
 assert.equal((await repairLegacyPlanIndex(db)).status, 'pending')
 assert.deepEqual(db.dropped, [])
})
test('removes only the obsolete index and is safe to rerun', async () => {
 const db = collection()
 assert.equal((await repairLegacyPlanIndex(db, { apply: true })).status, 'removed')
 assert.deepEqual(db.dropped, ['userId_1_slot_1'])
 assert.equal((await repairLegacyPlanIndex(collection(null), { apply: true })).status, 'absent')
})
test('refuses unexpected index definitions or legacy documents requiring data migration', async () => {
 await assert.rejects(repairLegacyPlanIndex(collection({ ...legacy, key: { user: 1 } }), { apply: true }), /Unexpected/)
 const db = collection(legacy, 1)
 await assert.rejects(repairLegacyPlanIndex(db, { apply: true }), /legacy fields/)
 assert.deepEqual(db.dropped, [])
})
