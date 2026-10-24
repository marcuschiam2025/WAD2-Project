import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequireAuth } from '../../middleware/authentication.js'
import { requireAdmin } from '../../middleware/admin.js'
const auth = {}
const User = {}
const requireAuth = createRequireAuth({ auth, User })

const token = { uid: 'demo-uid', email: 'staff@example.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } }
async function check(identity, existing) {
  const original = { verify: auth.verifyIdToken, find: User.findOne, create: User.findOrCreate }
  let created = false, passed = false
  const res = { status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
  try {
    auth.verifyIdToken = async () => identity
    User.findOne = async query => { assert.deepEqual(query, { firebaseUid: identity.uid }); return existing }
    User.findOrCreate = async () => { created = true; return { role: 'student' } }
    await requireAuth({ headers: { authorization: 'Bearer valid' } }, res, () => { passed = true })
    return { passed, created, code: res.code }
  } finally { auth.verifyIdToken = original.verify; User.findOne = original.find; User.findOrCreate = original.create }
}
test('preprovisioned admin UID can sign in with verified Google outside SMU', async () => {
  assert.equal((await check(token, { role: 'admin' })).passed, true)
})
test('ordinary non-SMU users cannot register or sign in', async () => {
  for (const existing of [null, { role: 'student' }]) {
    const result = await check(token, existing)
    assert.equal(result.code, 403); assert.equal(result.created, false)
  }
})
test('non-SMU admin requires verified Google identity', async () => {
  for (const identity of [{ ...token, email: undefined }, { ...token, email_verified: false }, { ...token, firebase: { sign_in_provider: 'password' } }]) {
    assert.equal((await check(identity, { role: 'admin' })).code, 403)
  }
})
test('SMU students retain first-login access', async () => {
  assert.equal((await check({ ...token, email: 'student@smu.edu.sg' }, null)).passed, true)
})
test('admin guard denies missing user and students', () => {
  for (const user of [undefined, { role: 'student' }]) {
    const res = { status(code) { assert.equal(code, 403); return this }, json() {} }
    assert.doesNotThrow(() => requireAdmin({ user }, res, () => assert.fail('must deny')))
  }
})
