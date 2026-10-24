import test from 'node:test'
import assert from 'node:assert/strict'
import { routeAccess } from '../src/core/router/access.js'

test('admin access policy sends staff to the panel without degree onboarding', async () => {
  const student = { isSignedIn: true, onboarded: false, profile: { role: 'student' } }
  const admin = { ...student, profile: { role: 'admin' } }
  assert.deepEqual(routeAccess({ name: 'admin', meta: { auth: true, admin: true } }, admin), undefined)
  assert.deepEqual(routeAccess({ name: 'signin', meta: {} }, admin), { name: 'admin' })
  assert.deepEqual(routeAccess({ name: 'onboarding', meta: { auth: true } }, admin), { name: 'admin' })
  assert.deepEqual(routeAccess({ name: 'admin', meta: { auth: true, admin: true } }, student), { name: 'onboarding' })
  assert.deepEqual(routeAccess({ name: 'admin', meta: { auth: true, admin: true } }, { ...student, onboarded: true }), { name: 'dashboard' })
  assert.deepEqual(routeAccess({ name: 'admin', meta: { auth: true, admin: true } }, { isSignedIn: false }), { name: 'signin' })
})
