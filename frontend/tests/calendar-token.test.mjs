import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

test('Google calendar tokens are scoped to their Firebase account and reject stale popups', async () => {
  let popupResult
  const auth = { currentUser: { uid: 'a', email: 'a@example.test' } }
  let popups = 0
  globalThis.__calendarSdk = {
    auth,
    GoogleAuthProvider: class { addScope() {} setCustomParameters() {} static credentialFromResult(result) { return { accessToken: result.token } } },
    reauthenticateWithPopup: async user => { popups++; return popupResult ?? { user, token: `token-${user.uid}` } },
  }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', ssr: { noExternal: ['firebase'] },
    resolve: { alias: { 'firebase/auth': '/__calendar-auth.js', 'firebase/app': '/__calendar-app.js' } },
    define: Object.fromEntries(['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_AUTH_DOMAIN'].map(key => [`import.meta.env.${key}`, JSON.stringify('test')])),
    plugins: [{ name: 'calendar-sdk-test', resolveId(id) { if (id === '/__calendar-auth.js') return '\0test:firebase/auth'; if (id === '/__calendar-app.js') return '\0test:firebase/app' }, load(id) {
      if (id === '\0test:firebase/app') return 'export const initializeApp = () => ({}); export const getApps = () => []'
      if (id === '\0test:firebase/auth') return 'const sdk = globalThis.__calendarSdk; export const getAuth = () => sdk.auth; export const GoogleAuthProvider = sdk.GoogleAuthProvider; export const reauthenticateWithPopup = sdk.reauthenticateWithPopup; export const signOut = async auth => { auth.currentUser = null }'
    } }],
  })
  try {
    const { authClient } = await server.ssrLoadModule('/src/core/services/firebase.js')
    assert.equal(await authClient.calendarAccessToken(), 'token-a')
    assert.equal(await authClient.calendarAccessToken(), 'token-a'); assert.equal(popups, 1)
    auth.currentUser = { uid: 'b', email: 'b@example.test' }
    assert.equal(await authClient.calendarAccessToken(), 'token-b', 'never return the previous account token')
    assert.equal(popups, 2)
    authClient.forgetCalendarToken()
    let resolve
    popupResult = new Promise(done => { resolve = done })
    const pending = authClient.calendarAccessToken()
    await Promise.resolve(); await Promise.resolve()
    await authClient.signOut()
    resolve({ user: { uid: 'b' }, token: 'stale-token' })
    await assert.rejects(pending, /changed|cancelled/i)
    auth.currentUser = null
    await assert.rejects(authClient.calendarAccessToken(), /Sign in/)
  } finally { await server.close(); delete globalThis.__calendarSdk }
})
