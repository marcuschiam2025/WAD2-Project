import test from 'node:test'
import assert from 'node:assert/strict'

test('bootstrap requires a verified enabled Google account and audits the UID grant', async () => {
  const { grantAdmin } = await import('./bootstrap.js').catch(() => ({}))
  assert.equal(typeof grantAdmin, 'function', 'controlled provisioning service is required')
  const target = { uid: 'target', email: 'staff@example.com', emailVerified: true, providerData: [{ providerId: 'google.com' }] }
  let grants = 0
  const dependencies = {
    auth: { getUser: async uid => { assert.equal(uid, 'target'); return target } },
    User: { findOneAndUpdate: async (filter, patch, options) => {
      grants++; assert.equal(filter.firebaseUid, 'target'); assert.equal(patch.$set.role, 'admin'); assert.ok(options.session)
      return { role: 'student' }
    } },
    auditedChange: async (entry, mutate) => { assert.equal(entry.action, 'grant-admin'); assert.equal(entry.actor.name, 'Min Xie'); return mutate({}) },
  }
  const result = await grantAdmin({ uid: 'target', operator: 'Min Xie' }, dependencies)
  assert.equal(result.after.role, 'admin'); assert.equal(grants, 1)
  for (const invalid of [{ emailVerified: false }, { disabled: true }, { providerData: [] }]) {
    await assert.rejects(grantAdmin({ uid: 'target', operator: 'Min Xie' }, { ...dependencies, auth: { getUser: async () => ({ ...target, ...invalid }) } }))
  }
  await assert.rejects(grantAdmin({ uid: 'target' }, dependencies))
  assert.equal(grants, 1, 'rejected targets must not be written')
})
