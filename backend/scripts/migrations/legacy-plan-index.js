// The current Plan model uses `user`, not the original `userId`/`slot` fields.
// A unique non-sparse index on the removed fields treats every new plan as (null, null).
export async function repairLegacyPlanIndex(collection, { apply = false } = {}) {
  const index = (await collection.indexes()).find(item => item.name === 'userId_1_slot_1')
  if (!index) return { status: 'absent' }
  const keys = Object.entries(index.key)
  if (!index.unique || keys.length !== 2 || keys[0][0] !== 'userId' || keys[0][1] !== 1 || keys[1][0] !== 'slot' || keys[1][1] !== 1) {
    throw new Error('Unexpected legacy plan index definition; inspect it manually before migrating')
  }
  const legacyCount = await collection.countDocuments({ $or: [{ userId: { $exists: true } }, { slot: { $exists: true } }] })
  if (legacyCount) throw new Error('Plans still contain legacy fields; migrate those documents before removing this index')
  if (!apply) return { status: 'pending', index: index.name }
  await collection.dropIndex(index.name)
  return { status: 'removed', index: index.name }
}
